import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { RequestUser, RoleCode } from "./request-user";
import { TenantClient } from "../db/db.service";
export const ROLE_LABELS: Record<RoleCode, string> = {
  lead2_engineer: "Lead2 Engineer",
  lead2_ops: "Lead2 Approver / Ops",
  client_super_admin: "Client Super Admin",
  client_manager: "Client Manager",
  sales_member: "Sales Team Member",
};
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  client_super_admin: ["*"],
  client_manager: [
    "lead.read",
    "lead.write",
    "lead.assign",
    "lead.delete",
    "task.write",
    "report.read",
    "proposal.write",
    "proposal.approve",
    "team.manage",
  ],
  sales_member: [
    "lead.read",
    "lead.write",
    "task.write",
    "report.read",
    "proposal.write",
  ],
};
export const DEFAULT_AUTHORITY: Record<string, any> = {
  client_super_admin: {
    selfDiscountPct: 100,
    approveDiscountPct: 100,
    approveTotal: 999999999999,
  },
  client_manager: {
    selfDiscountPct: 10,
    approveDiscountPct: 25,
    approveTotal: 1000000,
  },
  sales_member: { selfDiscountPct: 10, approveDiscountPct: 0, approveTotal: 0 },
};
export const ALL_PERMISSIONS = [
  ...new Set(
    Object.values(ROLE_PERMISSIONS)
      .flat()
      .filter((x) => x !== "*"),
  ),
  "pipeline.manage",
  "user.manage",
  "commercial.manage",
  "template.manage",
  "authority.manage",
  "audit.read",
];
export function hasPermission(u: RequestUser, p: string) {
  return u.permissions?.includes("*") || u.permissions?.includes(p);
}
export function requirePermission(u: RequestUser, p: string) {
  if (!u.tenantId || !hasPermission(u, p))
    throw new ForbiddenException(`Permission required: ${p}`);
}
export function tenantUserId(u: RequestUser) {
  return u.platformAdmin ? null : u.sub;
}
export function requirePlatform(u: RequestUser, engineerOnly = false) {
  if (
    !u.platformAdmin ||
    !["lead2_engineer", "lead2_ops"].includes(u.roleCode) ||
    (engineerOnly && u.roleCode !== "lead2_engineer")
  )
    throw new ForbiddenException("Lead2 platform access required");
}
export async function visibleUserIds(
  q: TenantClient,
  u: RequestUser,
): Promise<string[] | null> {
  if (!u.tenantId) throw new ForbiddenException("Select a client workspace");
  if (u.roleCode === "lead2_engineer" || u.roleCode === "client_super_admin")
    return null;
  if (u.roleCode !== "client_manager") return [u.sub];
  const r = await q.query<{ id: string }>(
    `WITH RECURSIVE team AS (SELECT id FROM users WHERE tenant_id=$1 AND id=$2 UNION SELECT u.id FROM users u JOIN team t ON u.manager_id=t.id WHERE u.tenant_id=$1) SELECT id FROM team`,
    [u.tenantId, u.sub],
  );
  return r.rows.map((x) => x.id);
}
export async function requireVisibleLead(
  q: TenantClient,
  u: RequestUser,
  id: string,
  lock = false,
) {
  const ids = await visibleUserIds(q, u);
  const l = (
    await q.query<any>(
      `SELECT * FROM leads WHERE tenant_id=$1 AND id=$2 AND ($3::uuid[] IS NULL OR owner_id=ANY($3)) ${lock ? "FOR UPDATE" : ""}`,
      [u.tenantId, id, ids],
    )
  ).rows[0];
  if (!l) throw new NotFoundException("Lead not found in your accessible team");
  return l;
}
export async function requireAssignee(
  q: TenantClient,
  u: RequestUser,
  id: string,
) {
  const ids = await visibleUserIds(q, u);
  const r = (
    await q.query<any>(
      "SELECT id FROM users WHERE tenant_id=$1 AND id=$2 AND active AND ($3::uuid[] IS NULL OR id=ANY($3))",
      [u.tenantId, id, ids],
    )
  ).rows[0];
  if (!r)
    throw new ForbiddenException(
      "Choose an active user in your accessible team",
    );
  return id;
}
export async function defaultOwner(q: TenantClient, u: RequestUser) {
  if (!u.platformAdmin) return u.sub;
  const row = (
    await q.query<any>(
      "SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE u.tenant_id=$1 AND u.active ORDER BY r.hierarchy_level,u.created_at LIMIT 1",
      [u.tenantId],
    )
  ).rows[0];
  if (!row)
    throw new ForbiddenException("Workspace needs an active client user");
  return row.id;
}
