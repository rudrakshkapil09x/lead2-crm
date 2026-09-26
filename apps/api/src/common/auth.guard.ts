import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { DbService } from "../db/db.service";
import {
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  DEFAULT_AUTHORITY,
} from "./permissions";
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private db: DbService,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const bearer = String(req.headers.authorization || "").replace(
      /^Bearer\s+/i,
      "",
    );
    const token = bearer || req.cookies?.lead2_session;
    if (!token) throw new UnauthorizedException("Please sign in");
    if (
      !bearer &&
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers["x-lead2-csrf"] !== "1"
    )
      throw new ForbiddenException("Request verification required");
    let claim: any;
    try {
      claim = await this.jwt.verifyAsync(token, { algorithms: ["HS256"] });
    } catch {
      throw new UnauthorizedException("Your session has expired");
    }
    if (!claim.sub) throw new UnauthorizedException();
    if (claim.platformAdmin) {
      const p = (
        await this.db.query(
          "SELECT id,name,email,role,token_version FROM platform_admins WHERE id=$1 AND active",
          [claim.sub],
        )
      ).rows[0];
      if (!p || p.token_version !== claim.tokenVersion)
        throw new UnauthorizedException("Access changed. Sign in again.");
      let tenant: any;
      if (claim.tenantId) {
        if (p.role !== "lead2_engineer")
          throw new ForbiddenException(
            "Only Lead2 engineers can open client workspaces",
          );
        tenant = (
          await this.db.query(
            "SELECT id,name,slug,settings FROM tenants WHERE id=$1",
            [claim.tenantId],
          )
        ).rows[0];
        if (!tenant) throw new UnauthorizedException();
      }
      req.user = {
        sub: p.id,
        name: p.name,
        email: p.email,
        role: ROLE_LABELS[p.role as keyof typeof ROLE_LABELS],
        roleCode: p.role,
        platformAdmin: true,
        tokenVersion: p.token_version,
        permissions: p.role === "lead2_engineer" ? ["*"] : ["platform.manage"],
        authority: DEFAULT_AUTHORITY.client_super_admin,
        tenantId: tenant?.id,
        tenantName: tenant?.name,
        tenantSlug: tenant?.slug,
        currency: tenant?.settings?.currency || "INR",
        ip: req.ip,
      };
    } else {
      if (!claim.tenantId) throw new UnauthorizedException();
      const data = await this.db.tenant(
        claim.tenantId,
        claim.sub,
        async (q) =>
          (
            await q.query<any>(
              `SELECT u.*,r.name role_name,r.code,r.permissions,r.authority,t.name tenant_name,t.slug,t.status,t.settings,t.agreement FROM users u JOIN roles r ON r.id=u.role_id JOIN tenants t ON t.id=u.tenant_id WHERE u.id=$1 AND u.tenant_id=$2 AND u.active`,
              [claim.sub, claim.tenantId],
            )
          ).rows[0],
      );
      if (
        !data ||
        data.token_version !== claim.tokenVersion ||
        data.status !== "active" ||
        (data.agreement.endDate &&
          new Date(data.agreement.endDate) < new Date())
      )
        throw new UnauthorizedException(
          "Account or workspace access is no longer active",
        );
      const ceiling = ROLE_PERMISSIONS[data.code] || [];
      const permissions = ceiling.includes("*")
        ? ["*"]
        : (data.permissions || []).filter((p: string) => ceiling.includes(p));
      const base = { ...DEFAULT_AUTHORITY[data.code], ...data.authority };
      const authority = { ...base };
      for (const key of [
        "selfDiscountPct",
        "approveDiscountPct",
        "approveTotal",
      ])
        if (data.authority_override?.[key] != null)
          authority[key] = Math.min(base[key], data.authority_override[key]);
      req.user = {
        sub: data.id,
        tenantId: data.tenant_id,
        tenantName: data.tenant_name,
        tenantSlug: data.slug,
        currency: data.settings.currency || "INR",
        name: data.name,
        email: data.email,
        role: data.role_name,
        roleCode: data.code,
        permissions,
        authority,
        platformAdmin: false,
        tokenVersion: data.token_version,
        mustChangePassword: data.must_change_password,
        ip: req.ip,
      };
      if (
        data.must_change_password &&
        !["/me", "/change-password", "/logout"].some((x) =>
          req.path.endsWith(x),
        )
      )
        throw new ForbiddenException(
          "Change your temporary password before continuing",
        );
    }
    return true;
  }
}
