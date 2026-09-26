import { TenantClient } from "../db/db.service";
import {
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  DEFAULT_AUTHORITY,
} from "../common/permissions";
export const DEFAULT_TEMPLATE = `<h1>{{proposal_title}}</h1><p>Prepared for <strong>{{client_name}}</strong> · {{company_name}}</p><p>{{proposal_number}} · {{proposal_date}}</p><h2>Your requirements</h2><p>{{scope}}</p><h2>Our commercial proposal</h2>{{commercial_table}}<h2>Delivery</h2><p>{{timeline}}</p><h2>Terms & conditions</h2><p>{{terms}}</p><p>Valid until {{valid_until}}.</p><p>Prepared by {{seller_name}}</p>`;
export async function seedTenant(
  q: TenantClient,
  tenantId: string,
  admin: any,
) {
  const roles: any = {};
  for (const [code, level] of [
    ["client_super_admin", 0],
    ["client_manager", 20],
    ["sales_member", 100],
  ] as const) {
    roles[code] = (
      await q.query<any>(
        "INSERT INTO roles(tenant_id,name,code,hierarchy_level,permissions,authority) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
        [
          tenantId,
          ROLE_LABELS[code],
          code,
          level,
          JSON.stringify(ROLE_PERMISSIONS[code]),
          JSON.stringify(DEFAULT_AUTHORITY[code]),
        ],
      )
    ).rows[0].id;
  }
  const user = (
    await q.query<any>(
      "INSERT INTO users(tenant_id,role_id,name,email,password_hash) VALUES($1,$2,$3,$4,$5) RETURNING id",
      [
        tenantId,
        roles.client_super_admin,
        admin.name,
        admin.email,
        admin.passwordHash,
      ],
    )
  ).rows[0];
  const pipe = (
    await q.query<any>(
      "INSERT INTO pipelines(tenant_id,name,is_default) VALUES($1,'Sales pipeline',true) RETURNING id",
      [tenantId],
    )
  ).rows[0];
  const stages = [
    ["New", "#72839c", 10, "open"],
    ["Contacted", "#4a8deb", 25, "open"],
    ["Qualified", "#9176df", 50, "open"],
    ["Proposal", "#e5aa45", 70, "open"],
    ["Negotiation", "#dd7b4e", 85, "open"],
    ["Won", "#2e9879", 100, "won"],
    ["Lost", "#cd6370", 0, "lost"],
  ];
  for (const [i, s] of stages.entries())
    await q.query(
      "INSERT INTO pipeline_stages(tenant_id,pipeline_id,name,color,probability,outcome,position) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [tenantId, pipe.id, ...s, i + 1],
    );
  await q.query(
    "INSERT INTO proposal_templates(tenant_id,name,body_html,questions) VALUES($1,$2,$3,$4)",
    [
      tenantId,
      "Lead2 standard proposal",
      DEFAULT_TEMPLATE,
      JSON.stringify([
        { key: "scope", label: "What does the customer need?", required: true },
        {
          key: "timeline",
          label: "What is the delivery timeline?",
          required: true,
        },
      ]),
    ],
  );
  return user.id;
}
