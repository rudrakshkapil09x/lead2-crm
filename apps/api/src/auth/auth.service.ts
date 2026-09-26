import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import * as crypto from "node:crypto";
import { DbService } from "../db/db.service";
import { MailService } from "../mail/mail.service";
import { MfaService } from "./mfa.service";
import { RequestUser } from "../common/request-user";
import {
  requirePlatform,
  requirePermission,
  tenantUserId,
} from "../common/permissions";
import * as v from "../common/validation";
import { seedTenant } from "./seed";

@Injectable()
export class AuthService {
  constructor(
    private db: DbService,
    private jwt: JwtService,
    private mail: MailService,
    private mfa: MfaService,
  ) {}

  private slug(x: any) {
    const s = v.str(x, "Workspace slug", 60).toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s))
      throw new BadRequestException(
        "Use lowercase letters, numbers and single hyphens for the workspace slug",
      );
    return s;
  }

  async registerRequest(b: any) {
    const type = b.requestType === "join" ? "join" : "workspace",
      slug = this.slug(b.tenantSlug),
      email = v.email(b.email),
      name = v.str(b.name, "Name", 120),
      hash = await bcrypt.hash(v.password(b.password), 12);
    const t = (
      await this.db.query("SELECT id FROM tenants WHERE slug=$1", [slug])
    ).rows[0];
    if ((type === "workspace" && t) || (type === "join" && !t))
      throw new BadRequestException(
        type === "workspace" ? "Workspace already exists" : "Workspace not found",
      );
    const r = await this.db.query(
      `INSERT INTO access_requests(request_type,tenant_name,tenant_slug,name,email,password_hash,requested_role) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,status,created_at,tenant_slug,email`,
      [
        type,
        type === "workspace" ? v.str(b.tenantName, "Company name", 180) : null,
        slug,
        name,
        email,
        hash,
        type === "workspace" ? "Client Super Admin" : "Sales Team Member",
      ],
    );
    return r.rows[0];
  }

  async registrationStatus(b: any) {
    const row = (
      await this.db.query(
        "SELECT id,status,reviewed_at FROM access_requests WHERE id=$1",
        [v.uuid(b.requestId)],
      )
    ).rows[0];
    if (!row) throw new NotFoundException();
    return row;
  }

  async login(b: any, platform = false) {
    const email = v.email(b.email),
      pass = String(b.password || "");
    let x: any;
    if (platform)
      x = (
        await this.db.query(
          "SELECT id,name,email,password_hash,token_version,mfa_enabled,mfa_secret FROM platform_admins WHERE lower(email)=$1 AND active",
          [email],
        )
      ).rows[0];
    else {
      const found = (
        await this.db.query("SELECT * FROM auth_login($1,$2)", [
          this.slug(b.tenantSlug),
          email,
        ])
      ).rows[0];
      if (found)
        x = await this.db.tenant(
          found.tenant_id,
          found.user_id,
          async (q) =>
            (
              await q.query(
                "SELECT id,tenant_id,password_hash,token_version,mfa_enabled,mfa_secret FROM users WHERE id=$1",
                [found.user_id],
              )
            ).rows[0],
        );
    }
    const valid = await bcrypt.compare(
      pass,
      x?.password_hash ||
        "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxAKBtDXrTm.QvgI6BLMtgdFita",
    );
    if (!x || !valid)
      throw new UnauthorizedException(
        "Check your workspace and sign-in details, or contact your administrator",
      );

    // MFA step-up: if MFA is enabled, issue a short-lived challenge token
    if (x.mfa_enabled && x.mfa_secret) {
      const challengeToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(challengeToken).digest("hex");
      await this.db.query(
        "INSERT INTO mfa_challenges(subject_id,platform_admin,tenant_id,token_hash) VALUES($1,$2,$3,$4)",
        [x.id, platform, x.tenant_id || null, tokenHash],
      );
      return { mfaRequired: true, mfaToken: challengeToken };
    }

    if (platform)
      await this.db.query(
        "UPDATE platform_admins SET last_login_at=now() WHERE id=$1",
        [x.id],
      );

    return this.issueTokens(x.id, x.tenant_id, platform, x.token_version);
  }

  async verifyMfa(b: any) {
    const tokenHash = crypto
      .createHash("sha256")
      .update(String(b.mfaToken || ""))
      .digest("hex");
    const challenge = (
      await this.db.query(
        "SELECT * FROM mfa_challenges WHERE token_hash=$1 AND expires_at>now()",
        [tokenHash],
      )
    ).rows[0];
    if (!challenge) throw new UnauthorizedException("MFA challenge expired or invalid");

    const table = challenge.platform_admin ? "platform_admins" : "users";
    const user = (
      await this.db.query(
        `SELECT id,tenant_id,token_version,mfa_secret FROM ${table} WHERE id=$1`,
        [challenge.subject_id],
      )
    ).rows[0];
    if (!user || !user.mfa_secret)
      throw new UnauthorizedException("MFA not configured");

    if (!this.mfa.verify(user.mfa_secret, String(b.totpCode || "")))
      throw new UnauthorizedException("Invalid authenticator code");

    // Invalidate challenge
    await this.db.query("DELETE FROM mfa_challenges WHERE id=$1", [challenge.id]);

    if (challenge.platform_admin)
      await this.db.query(
        "UPDATE platform_admins SET last_login_at=now() WHERE id=$1",
        [user.id],
      );

    return this.issueTokens(user.id, user.tenant_id, challenge.platform_admin, user.token_version);
  }

  async setupMfa(u: RequestUser) {
    const table = u.platformAdmin ? "platform_admins" : "users";
    const row = (
      await this.db.query(`SELECT email FROM ${table} WHERE id=$1`, [u.sub])
    ).rows[0];
    const { secret, otpAuthUrl } = this.mfa.generateSecret(row.email);
    const qrDataUrl = await this.mfa.generateQrDataUrl(otpAuthUrl);
    // Store temporarily — only committed on enable
    await this.db.query(`UPDATE ${table} SET mfa_secret=$2 WHERE id=$1`, [u.sub, secret]);
    return { secret, qrDataUrl };
  }

  async enableMfa(u: RequestUser, b: any) {
    const table = u.platformAdmin ? "platform_admins" : "users";
    const row = (
      await this.db.query(`SELECT mfa_secret FROM ${table} WHERE id=$1`, [u.sub])
    ).rows[0];
    if (!row?.mfa_secret)
      throw new BadRequestException("Set up MFA first with GET /auth/mfa/setup");
    if (!this.mfa.verify(row.mfa_secret, String(b.totpCode || "")))
      throw new BadRequestException("Invalid code — try again");
    await this.db.query(
      `UPDATE ${table} SET mfa_enabled=true WHERE id=$1`,
      [u.sub],
    );
    return { ok: true };
  }

  async disableMfa(u: RequestUser, b: any) {
    const table = u.platformAdmin ? "platform_admins" : "users";
    const row = (
      await this.db.query(
        `SELECT mfa_secret,password_hash FROM ${table} WHERE id=$1`,
        [u.sub],
      )
    ).rows[0];
    if (!await bcrypt.compare(String(b.currentPassword || ""), row.password_hash))
      throw new UnauthorizedException("Current password is incorrect");
    await this.db.query(
      `UPDATE ${table} SET mfa_enabled=false,mfa_secret=NULL WHERE id=$1`,
      [u.sub],
    );
    return { ok: true };
  }

  /** BUG-12: Refresh access token using long-lived refresh cookie */
  async refresh(refreshToken: string) {
    let claim: any;
    try {
      claim = await this.jwt.verifyAsync(refreshToken, {
        algorithms: ["HS256"],
        ignoreExpiration: false,
      });
    } catch {
      throw new UnauthorizedException("Refresh token expired");
    }
    if (!claim.sub || !claim.refresh)
      throw new UnauthorizedException("Invalid refresh token");

    const table = claim.platformAdmin ? "platform_admins" : "users";
    const row = (
      await this.db.query(
        `SELECT id,tenant_id,token_version FROM ${table} WHERE id=$1 AND active`,
        [claim.sub],
      )
    ).rows[0];
    if (!row || row.token_version !== claim.tokenVersion)
      throw new UnauthorizedException("Session revoked. Sign in again.");

    return this.issueTokens(
      row.id,
      row.tenant_id,
      !!claim.platformAdmin,
      row.token_version,
    );
  }

  private async issueTokens(
    userId: string,
    tenantId: string | null,
    platformAdmin: boolean,
    tokenVersion: number,
  ) {
    const payload = { sub: userId, tenantId, platformAdmin, tokenVersion };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: "4h" });
    const refreshToken = await this.jwt.signAsync(
      { ...payload, refresh: true },
      { expiresIn: "30d" },
    );
    return { accessToken, refreshToken };
  }

  async changePassword(u: RequestUser, b: any) {
    const newHash = await bcrypt.hash(v.password(b.password), 12);
    const change = async (q: any, table: string) => {
      const old = (
        await q.query(
          `SELECT password_hash FROM ${table} WHERE id=$1 FOR UPDATE`,
          [u.sub],
        )
      ).rows[0];
      if (
        !(await bcrypt.compare(
          String(b.currentPassword || ""),
          old.password_hash,
        ))
      )
        throw new UnauthorizedException("Current password is incorrect");
      await q.query(
        `UPDATE ${table} SET password_hash=$2,token_version=token_version+1${table === "users" ? ",must_change_password=false" : ""} WHERE id=$1`,
        [u.sub, newHash],
      );
    };
    if (u.platformAdmin)
      await this.db.transaction((q) => change(q, "platform_admins"));
    else
      await this.db.tenant(u.tenantId!, u.sub, async (q) => {
        await change(q, "users");
        await this.db.audit(q, u.tenantId!, u.sub, "user.password_changed", "user", u.sub);
      });
    return { ok: true };
  }

  /** BUG-03: Self-service password reset — step 1, request */
  async forgotPassword(b: any) {
    const email = v.email(b.email);
    const slug = this.slug(b.tenantSlug);
    // Always return ok to prevent email enumeration
    const user = (
      await this.db.query(
        `SELECT u.id,u.name,u.email,t.id tenant_id FROM users u
         JOIN tenants t ON t.id=u.tenant_id
         WHERE t.slug=$1 AND lower(u.email)=$2 AND u.active AND t.status='active'`,
        [slug, email],
      )
    ).rows[0];
    if (!user) return { ok: true };

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await this.db.query(
      "INSERT INTO password_reset_tokens(tenant_id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+INTERVAL '1 hour')",
      [user.tenant_id, user.id, tokenHash],
    );
    await this.mail.sendPasswordReset(user.email, token, slug);
    return { ok: true };
  }

  /** BUG-03: Self-service password reset — step 2, apply */
  async resetPassword(b: any) {
    const token = String(b.token || "");
    if (!token) throw new BadRequestException("Reset token is required");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const prt = (
      await this.db.query(
        "SELECT * FROM password_reset_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now()",
        [tokenHash],
      )
    ).rows[0];
    if (!prt) throw new BadRequestException("This reset link has expired or already been used");

    const newHash = await bcrypt.hash(v.password(b.password), 12);
    await this.db.transaction(async (q) => {
      await q.query(
        "UPDATE users SET password_hash=$2,token_version=token_version+1,must_change_password=false WHERE id=$1",
        [prt.user_id, newHash],
      );
      await q.query(
        "UPDATE password_reset_tokens SET used_at=now() WHERE id=$1",
        [prt.id],
      );
    });
    return { ok: true };
  }

  async logout(u: RequestUser) {
    const table = u.platformAdmin ? "platform_admins" : "users";
    if (u.platformAdmin)
      await this.db.query(
        `UPDATE ${table} SET token_version=token_version+1 WHERE id=$1`,
        [u.sub],
      );
    else
      await this.db.tenant(u.tenantId!, u.sub, (q) =>
        q.query("UPDATE users SET token_version=token_version+1 WHERE id=$1", [u.sub]),
      );
    return { ok: true };
  }

  async requests(u: RequestUser, status = "pending") {
    if (!["pending", "approved", "rejected"].includes(status))
      throw new BadRequestException("Invalid request status");
    if (u.platformAdmin) {
      requirePlatform(u);
      return (
        await this.db.query(
          "SELECT id,tenant_name,tenant_slug,name,email,status,created_at,review_note FROM access_requests WHERE request_type='workspace' AND status=$1 ORDER BY created_at DESC LIMIT 200",
          [status],
        )
      ).rows;
    }
    requirePermission(u, "user.manage");
    return (
      await this.db.query(
        "SELECT id,tenant_slug,name,email,status,created_at,review_note FROM access_requests WHERE request_type='join' AND tenant_slug=$1 AND status=$2 ORDER BY created_at DESC LIMIT 200",
        [u.tenantSlug, status],
      )
    ).rows;
  }

  agreement(b: any) {
    const seats = v.integer(b.seatLimit, "Licensed seats", 1, 100000),
      agreement = {
        reference: v.str(b.reference, "Agreement reference", 120),
        plan: v.str(b.plan || "Standard", "Plan", 80),
        amount: v.num(b.amount ?? 0, "Agreement amount"),
        currency: v.currency(b.currency || "INR"),
        billingCycle: ["monthly", "annual", "one_time"].includes(b.billingCycle)
          ? b.billingCycle
          : "annual",
        startDate: v.date(b.startDate, "Start date"),
        endDate: v.date(b.endDate, "End date"),
      };
    if (
      agreement.endDate &&
      agreement.startDate &&
      agreement.endDate < agreement.startDate
    )
      throw new BadRequestException("Agreement end must follow start");
    return { seats, agreement };
  }

  async approve(u: RequestUser, id: string, b: any) {
    const req = (
      await this.db.query("SELECT * FROM access_requests WHERE id=$1", [v.uuid(id)])
    ).rows[0];
    if (!req) throw new NotFoundException();
    if (req.request_type === "workspace") requirePlatform(u);
    else {
      requirePermission(u, "user.manage");
      if (req.tenant_slug !== u.tenantSlug) throw new ForbiddenException();
    }
    return this.db.transaction(async (q) => {
      const row = (
        await q.query("SELECT * FROM access_requests WHERE id=$1 FOR UPDATE", [id])
      ).rows[0];
      if (row.status !== "pending")
        throw new ConflictException("Request already reviewed");
      let tenantId: string, userId: string;
      if (row.request_type === "workspace") {
        const { seats, agreement } = this.agreement(b);
        tenantId = (
          await q.query(
            "INSERT INTO tenants(name,slug,seat_limit,agreement,settings,approved_by,approved_at) VALUES($1,$2,$3,$4,$5,$6,now()) RETURNING id",
            [row.tenant_name, row.tenant_slug, seats, JSON.stringify(agreement), JSON.stringify({ currency: agreement.currency }), u.sub],
          )
        ).rows[0].id;
        await q.query("SELECT set_config('app.current_tenant_id',$1,true)", [tenantId]);
        userId = await seedTenant(q, tenantId, {
          name: row.name,
          email: row.email,
          passwordHash: row.password_hash,
        });
        await q.query(
          "INSERT INTO agreement_history(tenant_id,actor_id,seat_limit,agreement) VALUES($1,$2,$3,$4)",
          [tenantId, u.sub, seats, JSON.stringify(agreement)],
        );
        await q.query(
          "INSERT INTO platform_audit_logs(actor_id,action,tenant_id) VALUES($1,'workspace.approved',$2)",
          [u.sub, tenantId],
        );
        // Email: notify the new super admin
        this.mail.sendWorkspaceApproved(row.email, row.name, row.tenant_slug).catch(() => null);
      } else {
        tenantId = u.tenantId!;
        await q.query("SELECT set_config('app.current_tenant_id',$1,true)", [tenantId]);
        const tenant = (
          await q.query("SELECT seat_limit FROM tenants WHERE id=$1 FOR UPDATE", [tenantId])
        ).rows[0];
        const count = (
          await q.query("SELECT count(*)::int n FROM users WHERE tenant_id=$1 AND active", [tenantId])
        ).rows[0].n;
        if (count >= tenant.seat_limit)
          throw new ConflictException("All licensed seats are in use. Contact Lead2 Ops.");
        const role = (
          await q.query("SELECT id FROM roles WHERE tenant_id=$1 AND code='sales_member'", [tenantId])
        ).rows[0];
        userId = (
          await q.query(
            "INSERT INTO users(tenant_id,role_id,name,email,password_hash) VALUES($1,$2,$3,$4,$5) RETURNING id",
            [tenantId, role.id, row.name, row.email, row.password_hash],
          )
        ).rows[0].id;
      }
      await q.query(
        "UPDATE access_requests SET status='approved',approved_tenant_id=$2,reviewed_by=$3,review_note=$4,reviewed_at=now() WHERE id=$1",
        [id, tenantId, u.platformAdmin ? u.sub : null, v.str(b.note || "Approved", "Note", 1000)],
      );
      await this.db.audit(q, tenantId, u.sub, "access.approved", "user", userId, { requestId: id });
      return { ok: true, tenantId, userId };
    });
  }

  async reject(u: RequestUser, id: string, b: any) {
    const row = (
      await this.db.query("SELECT * FROM access_requests WHERE id=$1", [v.uuid(id)])
    ).rows[0];
    if (!row) throw new NotFoundException();
    if (row.request_type === "workspace") requirePlatform(u);
    else {
      requirePermission(u, "user.manage");
      if (row.tenant_slug !== u.tenantSlug) throw new ForbiddenException();
    }
    const r = await this.db.query(
      "UPDATE access_requests SET status='rejected',reviewed_by=$2,review_note=$3,reviewed_at=now() WHERE id=$1 AND status='pending' RETURNING id",
      [id, u.platformAdmin ? u.sub : null, v.str(b.note || "Request declined", "Note", 1000)],
    );
    if (!r.rowCount) throw new ConflictException("Request already reviewed");
    // Email notification on rejection
    if (row.email)
      this.mail.sendWorkspaceRejected(row.email, row.name, b.note || "").catch(() => null);
    return { ok: true };
  }

  async platformSummary(u: RequestUser) {
    requirePlatform(u);
    // BUG-04: single query with lateral join instead of N+1
    const ts = (
      await this.db.query(
        `SELECT t.id,t.name,t.slug,t.status,t.seat_limit,t.agreement,t.created_at,
          count(u.id) FILTER(WHERE u.active) active_users
         FROM tenants t
         LEFT JOIN users u ON u.tenant_id=t.id
         GROUP BY t.id ORDER BY t.created_at DESC LIMIT 500`,
      )
    ).rows;
    return {
      tenants: ts,
      kpis: {
        active_tenants: ts.filter((x) => x.status === "active").length,
        pending_requests: (
          await this.db.query(
            "SELECT count(*)::int n FROM access_requests WHERE status='pending' AND request_type='workspace'",
          )
        ).rows[0].n,
        licensed_seats: ts.reduce((s, t) => s + (t.seat_limit || 0), 0),
      },
    };
  }

  async updateTenant(u: RequestUser, id: string, b: any) {
    requirePlatform(u);
    const { seats, agreement } = this.agreement(b);
    return this.db.tenant(v.uuid(id), null, async (q) => {
      const old = (
        await q.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [id])
      ).rows[0];
      if (!old) throw new NotFoundException();
      const used = (
        await q.query("SELECT count(*)::int n FROM users WHERE tenant_id=$1 AND active", [id])
      ).rows[0].n;
      if (seats < used)
        throw new ConflictException(
          `There are ${used} active users. Release seats before reducing the license.`,
        );
      if (!["active", "suspended"].includes(b.status))
        throw new BadRequestException("Invalid workspace status");
      await q.query("UPDATE tenants SET seat_limit=$2,agreement=$3,status=$4 WHERE id=$1", [
        id, seats, JSON.stringify(agreement), b.status,
      ]);
      await q.query(
        "INSERT INTO agreement_history(tenant_id,actor_id,seat_limit,agreement) VALUES($1,$2,$3,$4)",
        [id, u.sub, seats, JSON.stringify(agreement)],
      );
      await q.query(
        "INSERT INTO platform_audit_logs(actor_id,action,tenant_id,metadata) VALUES($1,'agreement.updated',$2,$3)",
        [u.sub, id, JSON.stringify({ seatLimit: seats, status: b.status })],
      );
      return { ok: true };
    });
  }

  async staff(u: RequestUser) {
    requirePlatform(u, true);
    return (
      await this.db.query(
        "SELECT id,name,email,role,active,last_login_at FROM platform_admins ORDER BY name",
      )
    ).rows;
  }

  async createOps(u: RequestUser, b: any) {
    requirePlatform(u, true);
    const hash = await bcrypt.hash(v.password(b.password), 12);
    const r = await this.db.query(
      "INSERT INTO platform_admins(name,email,password_hash,role) VALUES($1,$2,$3,'lead2_ops') RETURNING id",
      [v.str(b.name, "Name", 120), v.email(b.email), hash],
    );
    await this.db.query(
      "INSERT INTO platform_audit_logs(actor_id,action,metadata) VALUES($1,'ops.created',$2)",
      [u.sub, JSON.stringify({ id: r.rows[0].id })],
    );
    return r.rows[0];
  }

  async updateOps(u: RequestUser, id: string, b: any) {
    requirePlatform(u, true);
    if (typeof b.active !== "boolean")
      throw new BadRequestException("Active must be a boolean");
    const r = await this.db.query(
      "UPDATE platform_admins SET active=$2,token_version=token_version+1 WHERE id=$1 AND role='lead2_ops' RETURNING id",
      [v.uuid(id), b.active],
    );
    if (!r.rowCount) throw new NotFoundException("Ops account not found");
    await this.db.query(
      "INSERT INTO platform_audit_logs(actor_id,action,metadata) VALUES($1,'ops.access_changed',$2)",
      [u.sub, JSON.stringify({ id, active: b.active })],
    );
    return { ok: true };
  }

  async context(u: RequestUser, tenantId?: string) {
    requirePlatform(u, true);
    if (tenantId) {
      v.uuid(tenantId);
      const row = (
        await this.db.query("SELECT id FROM tenants WHERE id=$1", [tenantId])
      ).rows[0];
      if (!row) throw new NotFoundException();
      await this.db.query(
        "INSERT INTO platform_audit_logs(actor_id,action,tenant_id) VALUES($1,'engineer.workspace_opened',$2)",
        [u.sub, tenantId],
      );
    }
    return {
      accessToken: await this.jwt.signAsync(
        { sub: u.sub, platformAdmin: true, tenantId, tokenVersion: u.tokenVersion },
        { expiresIn: "4h" },
      ),
    };
  }

  async platformAudit(u: RequestUser) {
    requirePlatform(u);
    return (
      await this.db.query(
        "SELECT a.id,a.action,a.created_at,a.metadata,t.name tenant_name,p.name actor_name FROM platform_audit_logs a LEFT JOIN tenants t ON t.id=a.tenant_id LEFT JOIN platform_admins p ON p.id=a.actor_id ORDER BY a.id DESC LIMIT 200",
      )
    ).rows;
  }

  /** Google SSO: find-or-reject user by email in the given workspace */
  async googleLogin(profile: { email: string; name: string; slug: string }) {
    const { email, slug } = profile;
    if (!slug) throw new BadRequestException("Workspace slug is required");
    const found = (
      await this.db.query("SELECT * FROM auth_login($1,$2)", [this.slug(slug), email])
    ).rows[0];
    if (!found)
      throw new UnauthorizedException(
        "No active account with that Google email in this workspace. Contact your administrator.",
      );
    const x = await this.db.tenant(
      found.tenant_id,
      found.user_id,
      async (q) =>
        (
          await q.query(
            "SELECT id,tenant_id,token_version FROM users WHERE id=$1",
            [found.user_id],
          )
        ).rows[0],
    );
    return this.issueTokens(x.id, x.tenant_id, false, x.token_version);
  }
}
