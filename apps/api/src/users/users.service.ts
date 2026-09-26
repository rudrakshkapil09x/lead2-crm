import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { DbService, TenantClient } from "../db/db.service";
import { RequestUser } from "../common/request-user";
import {
  requirePermission,
  visibleUserIds,
  hasPermission,
  ROLE_PERMISSIONS,
  DEFAULT_AUTHORITY,
} from "../common/permissions";
import * as v from "../common/validation";
@Injectable()
export class UsersService {
  constructor(private db: DbService) {}
  async list(u: RequestUser) {
    return this.db.tenant(u.tenantId!, u.sub, async (q) => {
      const ids = await visibleUserIds(q, u);
      return (
        await q.query(
          `SELECT u.id,u.name,u.email,u.active,u.manager_id,u.authority_override,r.name role_name,r.code role_code,r.id role_id,r.authority,r.permissions,m.name manager_name FROM users u JOIN roles r ON r.id=u.role_id LEFT JOIN users m ON m.id=u.manager_id WHERE u.tenant_id=$1 AND ($2::uuid[] IS NULL OR u.id=ANY($2)) ORDER BY u.active DESC,r.hierarchy_level,u.name`,
          [u.tenantId, ids],
        )
      ).rows;
    });
  }
  async roles(u: RequestUser) {
    if (!u.tenantId) throw new ForbiddenException();
    return this.db.tenant(
      u.tenantId,
      u.sub,
      async (q) =>
        (
          await q.query(
            "SELECT * FROM roles WHERE tenant_id=$1 ORDER BY hierarchy_level",
            [u.tenantId],
          )
        ).rows,
    );
  }
  private async lock(q: TenantClient, u: RequestUser, needSeat = false) {
    const t = (
      await q.query("SELECT seat_limit FROM tenants WHERE id=$1 FOR UPDATE", [
        u.tenantId,
      ])
    ).rows[0];
    if (!t) throw new NotFoundException();
    if (needSeat) {
      const n = (
        await q.query(
          "SELECT count(*)::int n FROM users WHERE tenant_id=$1 AND active",
          [u.tenantId],
        )
      ).rows[0].n;
      if (n >= t.seat_limit)
        throw new ConflictException(
          "All licensed seats are in use. Release a seat or contact Lead2 Ops.",
        );
    }
  }
  private async validRole(q: TenantClient, u: RequestUser, id: string) {
    const r = (
      await q.query("SELECT * FROM roles WHERE tenant_id=$1 AND id=$2", [
        u.tenantId,
        v.uuid(id, "Role"),
      ])
    ).rows[0];
    if (!r || !Object.keys(ROLE_PERMISSIONS).includes(r.code))
      throw new BadRequestException("Choose a client role in this workspace");
    return r;
  }
  private async validManager(
    q: TenantClient,
    u: RequestUser,
    id: string | null,
    subjectId?: string,
  ) {
    if (!id) return;
    if (subjectId === id)
      throw new BadRequestException("A user cannot report to themselves");
    const r = (
      await q.query(
        "SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE u.tenant_id=$1 AND u.id=$2 AND u.active AND r.code IN ('client_manager','client_super_admin')",
        [u.tenantId, v.uuid(id, "Manager")],
      )
    ).rows[0];
    if (!r)
      throw new BadRequestException(
        "Choose an active manager or Client Super Admin",
      );
    if (subjectId) {
      const cycle = (
        await q.query(
          "WITH RECURSIVE parents AS (SELECT id,manager_id FROM users WHERE tenant_id=$1 AND id=$2 UNION SELECT u.id,u.manager_id FROM users u JOIN parents p ON u.id=p.manager_id WHERE u.tenant_id=$1) SELECT id FROM parents WHERE id=$3",
          [u.tenantId, id, subjectId],
        )
      ).rows.length;
      if (cycle)
        throw new BadRequestException(
          "This reporting relationship would create a cycle",
        );
    }
  }
  private async insert(q: TenantClient, u: RequestUser, b: any) {
    const role = await this.validRole(q, u, b.roleId);
    const manager = b.managerId || null;
    if (role.code === "client_super_admin" && manager)
      throw new BadRequestException(
        "A Client Super Admin does not report to another user",
      );
    await this.validManager(q, u, manager);
    const hash = await bcrypt.hash(v.password(b.password), 12);
    return (
      await q.query(
        "INSERT INTO users(tenant_id,role_id,manager_id,name,email,password_hash,must_change_password) VALUES($1,$2,$3,$4,$5,$6,true) RETURNING id,name,email",
        [
          u.tenantId,
          role.id,
          manager,
          v.str(b.name, "Name", 120),
          v.email(b.email),
          hash,
        ],
      )
    ).rows[0];
  }
  async create(u: RequestUser, b: any) {
    requirePermission(u, "user.manage");
    return this.db.tenant(u.tenantId!, u.sub, async (q) => {
      await this.lock(q, u, true);
      const user = await this.insert(q, u, b);
      await this.db.audit(
        q,
        u.tenantId!,
        u.sub,
        "user.created",
        "user",
        user.id,
        {},
        u.ip,
      );
      return user;
    });
  }
  async update(u: RequestUser, id: string, b: any) {
    requirePermission(u, "user.manage");
    return this.db.tenant(u.tenantId!, u.sub, async (q) => {
      await this.lock(q, u);
      const old = (
        await q.query(
          "SELECT u.*,r.code FROM users u JOIN roles r ON r.id=u.role_id WHERE u.tenant_id=$1 AND u.id=$2",
          [u.tenantId, v.uuid(id)],
        )
      ).rows[0];
      if (!old) throw new NotFoundException();
      if (b.active === false)
        throw new BadRequestException(
          "Use Remove & transfer to deactivate a user safely",
        );
      const role = await this.validRole(q, u, b.roleId || old.role_id),
        manager =
          b.managerId === undefined ? old.manager_id : b.managerId || null;
      if (
        old.code === "client_super_admin" &&
        role.code !== "client_super_admin"
      ) {
        if (id === u.sub)
          throw new BadRequestException(
            "Another super admin must change your role",
          );
        const n = (
          await q.query(
            "SELECT count(*)::int n FROM users u JOIN roles r ON r.id=u.role_id WHERE u.tenant_id=$1 AND u.active AND r.code='client_super_admin'",
            [u.tenantId],
          )
        ).rows[0].n;
        if (n <= 1)
          throw new ConflictException(
            "Keep at least one active Client Super Admin",
          );
      }
      if (
        role.code === "sales_member" &&
        (
          await q.query(
            "SELECT id FROM users WHERE tenant_id=$1 AND manager_id=$2 AND active LIMIT 1",
            [u.tenantId, id],
          )
        ).rows.length
      )
        throw new ConflictException(
          "Reassign this manager’s reportees before changing to Sales Team Member",
        );
      if (role.code === "client_super_admin" && manager)
        throw new BadRequestException("A Client Super Admin has no manager");
      await this.validManager(q, u, manager, id);
      if (!old.active && b.active === true) await this.lock(q, u, true);
      const hash = b.password
        ? await bcrypt.hash(v.password(b.password), 12)
        : old.password_hash;
      await q.query(
        "UPDATE users SET name=$3,email=$4,role_id=$5,manager_id=$6,active=$7,password_hash=$8,must_change_password=CASE WHEN $9 THEN true ELSE must_change_password END,token_version=token_version+1,authority_override=CASE WHEN role_id<>$5 THEN NULL ELSE authority_override END WHERE tenant_id=$1 AND id=$2",
        [
          u.tenantId,
          id,
          b.name === undefined ? old.name : v.str(b.name, "Name", 120),
          b.email === undefined ? old.email : v.email(b.email),
          role.id,
          manager,
          b.active === true ? true : old.active,
          hash,
          !!b.password,
        ],
      );
      await this.db.audit(q, u.tenantId!, u.sub, "user.updated", "user", id, {
        fields: Object.keys(b).filter((k) => k !== "password"),
      }, u.ip);
      return { ok: true };
    });
  }
  async remove(u: RequestUser, id: string, b: any) {
    requirePermission(u, "user.manage");
    if (id === u.sub)
      throw new BadRequestException("You cannot remove your own account");
    return this.db.tenant(u.tenantId!, u.sub, async (q) => {
      await this.lock(q, u);
      const old = (
        await q.query(
          "SELECT u.*,r.code FROM users u JOIN roles r ON r.id=u.role_id WHERE u.tenant_id=$1 AND u.id=$2 AND u.active FOR UPDATE OF u",
          [u.tenantId, v.uuid(id)],
        )
      ).rows[0];
      if (!old) throw new NotFoundException("Active user not found");
      if (
        old.code === "client_super_admin" &&
        (
          await q.query(
            "SELECT count(*)::int n FROM users u JOIN roles r ON r.id=u.role_id WHERE u.tenant_id=$1 AND u.active AND r.code='client_super_admin'",
            [u.tenantId],
          )
        ).rows[0].n <= 1
      )
        throw new ConflictException("Create another active super admin first");
      // The released seat and optional replacement are part of the same transaction.
      await q.query(
        "UPDATE users SET active=false,token_version=token_version+1 WHERE id=$1",
        [id],
      );
      let replacementId = b.replacementId;
      if (b.newUser) {
        await this.lock(q, u, true);
        replacementId = (await this.insert(q, u, b.newUser)).id;
      }
      if (!replacementId || replacementId === id)
        throw new BadRequestException(
          "Choose an existing user or create a replacement",
        );
      const target = (
        await q.query(
          "SELECT u.*,r.code FROM users u JOIN roles r ON r.id=u.role_id WHERE u.tenant_id=$1 AND u.id=$2 AND u.active",
          [u.tenantId, v.uuid(replacementId)],
        )
      ).rows[0];
      if (!target)
        throw new BadRequestException(
          "Replacement must be active in this workspace",
        );
      const reportees = (
        await q.query(
          "SELECT id FROM users WHERE tenant_id=$1 AND manager_id=$2",
          [u.tenantId, id],
        )
      ).rows;
      if (reportees.length) {
        const newManager =
          b.reporteesManagerId ||
          (target.code !== "sales_member" ? target.id : target.manager_id);
        if (!newManager)
          throw new BadRequestException("Choose a new reporting manager");
        if (newManager === id)
          throw new BadRequestException("Reporting manager is being removed");
        await this.validManager(q, u, newManager);
        for (const child of reportees) {
          if (child.id === newManager) {
            await this.validManager(q, u, old.manager_id, child.id);
            await q.query("UPDATE users SET manager_id=$2 WHERE id=$1", [
              child.id,
              old.manager_id,
            ]);
          } else {
            await this.validManager(q, u, newManager, child.id);
            await q.query("UPDATE users SET manager_id=$2 WHERE id=$1", [
              child.id,
              newManager,
            ]);
          }
        }
      }
      const leads = await q.query(
        "UPDATE leads SET owner_id=$3,updated_at=now() WHERE tenant_id=$1 AND owner_id=$2",
        [u.tenantId, id, replacementId],
      );
      const tasks = await q.query(
        "UPDATE tasks SET assignee_id=$3 WHERE tenant_id=$1 AND assignee_id=$2 AND status='open'",
        [u.tenantId, id, replacementId],
      );
      await q.query(
        "UPDATE proposals SET owner_id=$3,updated_at=now() WHERE tenant_id=$1 AND owner_id=$2",
        [u.tenantId, id, replacementId],
      );
      await this.db.audit(
        q,
        u.tenantId!,
        u.sub,
        "user.removed_and_transferred",
        "user",
        id,
        { replacementId, leads: leads.rowCount, tasks: tasks.rowCount },
        u.ip,
      );
      return {
        ok: true,
        replacementId,
        transferredLeads: leads.rowCount,
        transferredTasks: tasks.rowCount,
      };
    });
  }
  async authority(u: RequestUser, id: string, b: any) {
    requirePermission(u, "authority.manage");
    return this.db.tenant(u.tenantId!, u.sub, async (q) => {
      await this.lock(q, u);
      const role = await this.validRole(q, u, id);
      if (role.code === "client_super_admin")
        throw new BadRequestException("Super Admin authority is fixed");
      const ceiling = ROLE_PERMISSIONS[role.code];
      if (
        !Array.isArray(b.permissions) ||
        b.permissions.some((p: any) => !ceiling.includes(p))
      )
        throw new BadRequestException(
          "This role cannot receive the requested permissions",
        );
      if (!b.permissions.includes("lead.read"))
        throw new BadRequestException("Keep lead.read enabled");
      const authority = {
        selfDiscountPct: v.num(
          b.selfDiscountPct,
          "Self-authorized discount",
          0,
          100,
        ),
        approveDiscountPct: v.num(
          b.approveDiscountPct,
          "Approval discount",
          0,
          100,
        ),
        approveTotal: v.num(b.approveTotal, "Approval amount"),
      };
      if (
        role.code === "sales_member" &&
        (authority.approveDiscountPct !== 0 || authority.approveTotal !== 0)
      )
        throw new BadRequestException(
          "Sales team members cannot approve proposals",
        );
      await q.query(
        "UPDATE roles SET permissions=$3,authority=$4 WHERE tenant_id=$1 AND id=$2",
        [
          u.tenantId,
          id,
          JSON.stringify(b.permissions),
          JSON.stringify(authority),
        ],
      );
      await this.db.audit(
        q,
        u.tenantId!,
        u.sub,
        "authority.role_updated",
        "role",
        id,
        { authority, permissions: b.permissions },
        u.ip,
      );
      return { ok: true };
    });
  }
  async teamAuthority(u: RequestUser, id: string, b: any) {
    requirePermission(u, "team.manage");
    if (id === u.sub)
      throw new ForbiddenException(
        "Ask your administrator to change your authority",
      );
    return this.db.tenant(u.tenantId!, u.sub, async (q) => {
      await this.lock(q, u);
      const ids = await visibleUserIds(q, u);
      if (ids && !ids.includes(id)) throw new ForbiddenException();
      const person = (
        await q.query(
          "SELECT u.id,r.authority,r.code FROM users u JOIN roles r ON r.id=u.role_id WHERE u.tenant_id=$1 AND u.id=$2",
          [u.tenantId, v.uuid(id)],
        )
      ).rows[0];
      if (!person) throw new NotFoundException();
      if (person.code === "client_super_admin") throw new ForbiddenException();
      const policy: any = {};
      for (const key of [
        "selfDiscountPct",
        "approveDiscountPct",
        "approveTotal",
      ] as const) {
        const ceiling = Math.min(
          person.authority[key] ?? DEFAULT_AUTHORITY[person.code][key],
          u.authority[key],
        );
        policy[key] = v.num(b[key], key, 0, ceiling);
      }
      await q.query(
        "UPDATE users SET authority_override=$3 WHERE tenant_id=$1 AND id=$2",
        [u.tenantId, id, JSON.stringify(policy)],
      );
      await this.db.audit(
        q,
        u.tenantId!,
        u.sub,
        "authority.member_updated",
        "user",
        id,
        { policy },
        u.ip,
      );
      return { ok: true };
    });
  }
  async reporting(u: RequestUser, id: string, b: any) {
    requirePermission(u, "team.manage");
    if (id === u.sub)
      throw new ForbiddenException("You cannot change your own reporting line");
    return this.db.tenant(u.tenantId!, u.sub, async (q) => {
      await this.lock(q, u);
      const ids = await visibleUserIds(q, u);
      if (ids && (!ids.includes(id) || !ids.includes(b.managerId)))
        throw new ForbiddenException("Choose users in your reporting tree");
      const target = (
        await q.query(
          "SELECT u.id,r.code FROM users u JOIN roles r ON r.id=u.role_id WHERE u.tenant_id=$1 AND u.id=$2 AND u.active",
          [u.tenantId, v.uuid(id)],
        )
      ).rows[0];
      if (!target) throw new NotFoundException();
      if (target.code === "client_super_admin")
        throw new ForbiddenException("Super admins have no reporting manager");
      await this.validManager(q, u, b.managerId || null, id);
      await q.query(
        "UPDATE users SET manager_id=$3 WHERE tenant_id=$1 AND id=$2",
        [u.tenantId, id, b.managerId || null],
      );
      await this.db.audit(
        q,
        u.tenantId!,
        u.sub,
        "user.reporting_changed",
        "user",
        id,
        { managerId: b.managerId },
        u.ip,
      );
      return { ok: true };
    });
  }
  async workspace(u: RequestUser) {
    if (!u.tenantId) throw new ForbiddenException();
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      const t = (
        await q.query(
          "SELECT id,name,slug,seat_limit,settings,agreement FROM tenants WHERE id=$1",
          [u.tenantId],
        )
      ).rows[0];
      t.active_users = (
        await q.query(
          "SELECT count(*)::int n FROM users WHERE tenant_id=$1 AND active",
          [u.tenantId],
        )
      ).rows[0].n;
      if (!hasPermission(u, "user.manage")) delete t.agreement;
      return t;
    });
  }
  async audit(u: RequestUser) {
    requirePermission(u, "audit.read");
    return this.db.tenant(
      u.tenantId!,
      u.sub,
      async (q) =>
        (
          await q.query(
            "SELECT a.id,a.action,a.entity_type,a.entity_id,a.metadata,a.created_at,u.name actor_name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id WHERE a.tenant_id=$1 ORDER BY a.id DESC LIMIT 200",
            [u.tenantId],
          )
        ).rows,
    );
  }
}
