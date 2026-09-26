import * as bcrypt from "bcryptjs";
import { seedTenant } from "../auth/seed";
import { CryptoService } from "../common/crypto.service";
export async function demoData(db: any, password: string) {
  const existing = await db.query(
    "SELECT id FROM tenants WHERE slug='lead2-demo'",
  );
  if (existing.rows.length) throw new Error("Demo workspace already exists");
  const hash = await bcrypt.hash(password, 12),
    crypto = new CryptoService();
  const tid = (
    await db.query(
      "INSERT INTO tenants(name,slug,seat_limit,settings,agreement) VALUES('Evergreen Studio','lead2-demo',15,$1,$2) RETURNING id",
      [
        JSON.stringify({ currency: "INR" }),
        JSON.stringify({
          reference: "DEMO-2026",
          plan: "Team",
          amount: 120000,
          currency: "INR",
          billingCycle: "annual",
        }),
      ],
    )
  ).rows[0].id;
  await db.tenant(tid, null, async (q: any) => {
    const admin = await seedTenant(q, tid, {
      name: "Alex Morgan",
      email: "admin@lead2.demo",
      passwordHash: hash,
    });
    const roles = (
      await q.query("SELECT * FROM roles WHERE tenant_id=$1", [tid])
    ).rows;
    const role = (code: string) => roles.find((r: any) => r.code === code).id;
    const persons = [
      ["Maya Patel", "manager@lead2.demo", "client_manager", admin],
      ["Daniel Kim", "manager2@lead2.demo", "client_manager", admin],
      ["Sarah Chen", "sales@lead2.demo", "sales_member", null],
      ["James Wilson", "james@lead2.demo", "sales_member", null],
      ["Olivia Brooks", "olivia@lead2.demo", "sales_member", null],
    ];
    const ids: string[] = [];
    for (const [i, p] of persons.entries()) {
      const manager = p[3] || (i === 4 ? ids[1] : ids[0]);
      ids.push(
        (
          await q.query(
            "INSERT INTO users(tenant_id,role_id,name,email,password_hash,manager_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
            [tid, role(p[2]!), p[0], p[1], hash, manager],
          )
        ).rows[0].id,
      );
    }
    const pipe = (
        await q.query("SELECT id FROM pipelines WHERE tenant_id=$1", [tid])
      ).rows[0].id,
      stages = (
        await q.query(
          "SELECT id,name,outcome FROM pipeline_stages WHERE tenant_id=$1 ORDER BY position",
          [tid],
        )
      ).rows;
    const contacts = [
      ["Sophie Martin", "Northstar Labs", 125000, 3, 2, "Website"],
      ["Liam Anderson", "Atlas & Co.", 85000, 2, 3, "Referral"],
      ["Emma Thompson", "Bloom Collective", 240000, 4, 4, "Partner"],
      ["Noah Williams", "Meridian Group", 62000, 1, 2, "LinkedIn"],
      ["Isabella Rossi", "Forma Design", 178000, 2, 4, "Website"],
      ["Oliver James", "Vista Technologies", 95000, 0, 3, "Event"],
      ["Ava Garcia", "Solstice Health", 340000, 5, 2, "Referral"],
      ["Ethan Davis", "Summit Ventures", 155000, 3, 3, "Partner"],
      ["Amelia Taylor", "Kindred Home", 46000, 0, 4, "Website"],
      ["Lucas Brown", "Orbit Digital", 128000, 1, 2, "LinkedIn"],
      ["Mia Chen", "Lumen Finance", 285000, 4, 3, "Referral"],
      ["Henry Wilson", "Oak & Stone", 76000, 6, 4, "Event"],
      ["Grace Lee", "Cedar Systems", 99000, 2, 2, "Partner"],
      ["Leo Walker", "Grove Retail", 53000, 1, 4, "Website"],
      ["Ella King", "Coastal Brands", 88000, 3, 2, "Referral"],
    ];
    const leads: string[] = [];
    for (const [i, x] of contacts.entries()) {
      const stage = stages[x[3] as number],
        owner = ids[x[4] as number],
        createdDays = 2 + i * 2,
        stageDays = 1 + (i % 12),
        email = `contact${i + 1}@example.test`;
      const lead = (
        await q.query(
          `INSERT INTO leads(tenant_id,pipeline_id,stage_id,owner_id,name,company,value,source,status,email_enc,email_hash,created_at,stage_entered_at,closed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now()-$12::int*interval '1 day',now()-$13::int*interval '1 day',CASE WHEN $9='open' THEN NULL ELSE now() END) RETURNING id`,
          [
            tid,
            pipe,
            stage.id,
            owner,
            x[0],
            x[1],
            x[2],
            x[5],
            stage.outcome,
            crypto.encrypt(email),
            crypto.contactHash(email),
            createdDays,
            stageDays,
          ],
        )
      ).rows[0].id;
      leads.push(lead);
      await q.query(
        "INSERT INTO activities(tenant_id,lead_id,user_id,type,body) VALUES($1,$2,$3,'note',$4)",
        [
          tid,
          lead,
          owner,
          "Initial discovery completed. Discuss requirements and confirm next steps.",
        ],
      );
      await q.query(
        "INSERT INTO lead_stage_history(tenant_id,lead_id,pipeline_id,stage_id,entered_at,changed_by) VALUES($1,$2,$3,$4,now()-$5::int*interval '1 day',$6)",
        [tid, lead, pipe, stage.id, stageDays, owner],
      );
    }
    for (const [i, title] of [
      "Follow up with Sophie",
      "Review Northstar proposal",
      "Schedule Atlas discovery",
      "Send implementation outline",
    ].entries())
      await q.query(
        "INSERT INTO tasks(tenant_id,lead_id,assignee_id,created_by,title,due_at) VALUES($1,$2,$3,$4,$5,now()+$6::int*interval '1 day')",
        [
          tid,
          leads[i === 3 ? 0 : i],
          ids[i === 2 ? 4 : i === 1 ? 3 : 2],
          admin,
          title,
          i - 2,
        ],
      );
    const { randomUUID } = await import("node:crypto");
    await q.query(
      "INSERT INTO commercial_catalogs(tenant_id,name,currency,tax_pct,items,terms) VALUES($1,'Growth services · India','INR',18,$2,$3)",
      [
        tid,
        JSON.stringify([
          {
            id: randomUUID(),
            description: "Discovery & strategy workshop",
            unit: "workshop",
            unitPrice: 25000,
          },
          {
            id: randomUUID(),
            description: "Implementation & onboarding",
            unit: "project",
            unitPrice: 75000,
          },
          {
            id: randomUUID(),
            description: "Ongoing advisory",
            unit: "month",
            unitPrice: 15000,
          },
        ]),
        "50% advance. Balance due within 30 days of delivery. Scope changes require written agreement.",
      ],
    );
  });
  for (const [role, name, email] of [
    ["lead2_engineer", "Lead2 Engineer", "engineer@lead2.demo"],
    ["lead2_ops", "Lead2 Operations", "ops@lead2.demo"],
  ])
    if (
      !(
        await db.query("SELECT id FROM platform_admins WHERE email=$1", [email])
      ).rows.length
    )
      await db.query(
        "INSERT INTO platform_admins(role,name,email,password_hash) VALUES($1,$2,$3,$4)",
        [role, name, email, hash],
      );
  return tid;
}
