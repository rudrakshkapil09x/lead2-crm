export type RoleCode =
  | "lead2_engineer"
  | "lead2_ops"
  | "client_super_admin"
  | "client_manager"
  | "sales_member";
export type Authority = {
  selfDiscountPct: number;
  approveDiscountPct: number;
  approveTotal: number;
};
export type RequestUser = {
  sub: string;
  tenantId?: string;
  tenantName?: string;
  tenantSlug?: string;
  currency?: string;
  email: string;
  name: string;
  role: string;
  roleCode: RoleCode;
  permissions: string[];
  authority: Authority;
  platformAdmin: boolean;
  tokenVersion: number;
  mustChangePassword?: boolean;
};
