import "reflect-metadata";
import { Test } from "@nestjs/testing";
import request from "supertest";
import * as bcrypt from "bcryptjs";
import { AppModule } from "../src/app.module";
import { DbService } from "../src/db/db.service";
import { configureApp } from "../src/common/http";
import { database } from "./db-harness";
import { seedTenant } from "../src/auth/seed";
import { randomUUID } from "node:crypto";
const pass = "Lead2-test-password-123!";
describe("Lead2 end-to-end authorization and workflows", () => {
  let app: any,
    db: any,
    admin: any,
    manager: any,
    sales: any,
    outsider: any,
    ops: any,
    engineer: any,
    tid: string,
    otherTid: string,
    adminId: string,
    managerId: string,
    salesId: string,
    outsiderId: string,
    roles: any,
    lead: any;
  const agent = () => request.agent(app.getHttpServer());
  const post = (a: any, path: string, b: any) =>
    a
      .post("/api" + path)
      .set("X-Lead2-CSRF", "1")
      .send(b);
  const patch = (a: any, path: string, b: any) =>
    a
      .patch("/api" + path)
      .set("X-Lead2-CSRF", "1")
      .send(b);
  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.FIELD_ENCRYPTION_KEY = "a".repeat(64);
    process.env.CONTACT_HASH_KEY = "test-contact-hash-key-123456789";
    db = await database();
    const m = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DbService)
      .useValue(db)
      .compile();
    app = m.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
    const hash = await bcrypt.hash(pass, 4);
    tid = (
      await db.query(
        "INSERT INTO tenants(name,slug,seat_limit) VALUES('Acme','acme',8) RETURNING id",
      )
    ).rows[0].id;
    otherTid = (
      await db.query(
        "INSERT INTO tenants(name,slug,seat_limit) VALUES('Other','other',2) RETURNING id",
      )
    ).rows[0].id;
    adminId = await db.tenant(tid, null, (q: any) =>
      seedTenant(q, tid, {
        name: "Admin",
        email: "admin@acme.test",
        passwordHash: hash,
      }),
    );
    await db.tenant(otherTid, null, (q: any) =>
      seedTenant(q, otherTid, {
        name: "Other",
        email: "other@other.test",
        passwordHash: hash,
      }),
    );
    roles = await db.tenant(tid, null, async (q: any) =>
      (
        await q.query("SELECT id,code FROM roles WHERE tenant_id=$1", [tid])
      ).rows.reduce((s: any, r: any) => ({ ...s, [r.code]: r.id }), {}),
    );
    [managerId, salesId, outsiderId] = await db.tenant(
      tid,
      null,
      async (q: any) => {
        const m = (
          await q.query(
            "INSERT INTO users(tenant_id,role_id,name,email,password_hash,manager_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
            [
              tid,
              roles.client_manager,
              "Manager",
              "manager@acme.test",
              hash,
              adminId,
            ],
          )
        ).rows[0].id;
        const s = (
          await q.query(
            "INSERT INTO users(tenant_id,role_id,name,email,password_hash,manager_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
            [tid, roles.sales_member, "Sales", "sales@acme.test", hash, m],
          )
        ).rows[0].id;
        const o = (
          await q.query(
            "INSERT INTO users(tenant_id,role_id,name,email,password_hash) VALUES($1,$2,$3,$4,$5) RETURNING id",
            [tid, roles.sales_member, "Other team", "outsider@acme.test", hash],
          )
        ).rows[0].id;
        return [m, s, o];
      },
    );
    for (const [role, email] of [
      ["lead2_engineer", "engineer@lead2.test"],
      ["lead2_ops", "ops@lead2.test"],
    ])
      await db.query(
        "INSERT INTO platform_admins(name,email,password_hash,role) VALUES($1,$2,$3,$4)",
        [role, email, hash, role],
      );
    admin = agent();
    manager = agent();
    sales = agent();
    outsider = agent();
    ops = agent();
    engineer = agent();
    for (const [a, email] of [
      [admin, "admin"],
      [manager, "manager"],
      [sales, "sales"],
      [outsider, "outsider"],
    ])
      await post(a, "/auth/login", {
        tenantSlug: "acme",
        email: email + "@acme.test",
        password: pass,
      }).expect(201);
    for (const [a, email] of [
      [ops, "ops"],
      [engineer, "engineer"],
    ])
      await post(a, "/auth/super-admin/login", {
        email: email + "@lead2.test",
        password: pass,
      }).expect(201);
  });
  afterAll(async () => {
    await app?.close();
    await db?.close();
  });
  it("exposes exactly five roles and scopes user directories", async () => {
    expect(
      (await admin.get("/api/users/roles")).body.map((x: any) => x.code),
    ).toEqual(["client_super_admin", "client_manager", "sales_member"]);
    expect((await sales.get("/api/users")).body).toHaveLength(1);
    expect((await manager.get("/api/users")).body).toHaveLength(2);
    expect((await ops.get("/api/auth/me")).body.roleCode).toBe("lead2_ops");
    expect((await engineer.get("/api/auth/me")).body.roleCode).toBe(
      "lead2_engineer",
    );
  });
  it("lets sales create own leads and managers see reportees, hides sibling team data", async () => {
    lead = (
      await post(sales, "/leads", {
        name: "Customer",
        email: "customer@example.com",
        value: 12000,
      }).expect(201)
    ).body;
    await post(outsider, "/leads", {
      name: "Hidden customer",
      value: 7000,
    }).expect(201);
    expect((await manager.get("/api/leads")).body).toHaveLength(1);
    await outsider.get("/api/leads/" + lead.id).expect(404);
    await post(outsider, `/leads/${lead.id}/activities`, {
      body: "Unauthorized",
    }).expect(404);
    await patch(sales, "/leads/" + lead.id, { ownerId: outsiderId }).expect(
      403,
    );
  });
  it("uses the same reporting scope in dashboard and linked task access", async () => {
    const dashboard = (await manager.get("/api/dashboard").expect(200)).body;
    expect(dashboard.kpis.leads).toBe(1);
    await post(outsider, "/tasks", {
      leadId: lead.id,
      title: "Unauthorized",
    }).expect(404);
    await post(sales, "/tasks", { leadId: lead.id, title: "Follow up" }).expect(
      201,
    );
    expect((await manager.get("/api/tasks")).body).toHaveLength(1);
  });
  it("rejects foreign tenant references and user-created platform roles", async () => {
    const foreign = (
      await db.tenant(
        otherTid,
        null,
        async (q: any) =>
          (
            await q.query("SELECT id FROM roles WHERE tenant_id=$1 LIMIT 1", [
              otherTid,
            ])
          ).rows[0],
      )
    ).id;
    await post(admin, "/users", {
      name: "Bad role",
      email: "bad@acme.test",
      password: pass,
      roleId: foreign,
    }).expect(400);
    await post(sales, "/users", {
      name: "Bad",
      email: "bad@acme.test",
      password: pass,
      roleId: roles.client_super_admin,
    }).expect(403);
    await post(ops, "/auth/super-admin/context", { tenantId: tid }).expect(403);
    await ops.get("/api/leads").expect(403);
  });
  it("blocks reporting cycles and loss of the last super admin", async () => {
    await patch(admin, "/users/" + managerId, { managerId: managerId }).expect(
      400,
    );
    await patch(admin, "/users/" + adminId, {
      roleId: roles.sales_member,
    }).expect(400);
  });
  it("supports nested managers and rejects cycles or reassignment outside a manager’s team", async () => {
    const nested = (
      await post(admin, "/users", {
        name: "Nested manager",
        email: "nested@acme.test",
        password: pass,
        roleId: roles.client_manager,
        managerId,
      }).expect(201)
    ).body;
    await patch(admin, "/users/" + salesId + "/reporting", {
      managerId: nested.id,
    }).expect(200);
    expect((await manager.get("/api/users")).body).toHaveLength(3);
    expect((await manager.get("/api/leads")).body).toHaveLength(1);
    await patch(admin, "/users/" + managerId + "/reporting", {
      managerId: nested.id,
    }).expect(400);
    await patch(manager, "/users/" + outsiderId + "/reporting", {
      managerId,
    }).expect(403);
    await patch(admin, "/users/" + salesId + "/reporting", {
      managerId,
    }).expect(200);
    await post(admin, "/users/" + nested.id + "/remove", {
      replacementId: managerId,
    }).expect(201);
  });
  it("requires CSRF verification for cookie mutations and safely rejects malformed input", async () => {
    await sales.post("/api/leads").send({ name: "No CSRF" }).expect(403);
    await post(sales, "/leads", { name: "Negative deal", value: -1 }).expect(
      400,
    );
    await sales.get("/api/leads/not-a-uuid").expect(400);
    await patch(sales, "/leads/" + lead.id, { stageId: randomUUID() }).expect(
      400,
    );
    const duplicate = (
      await post(sales, "/leads", {
        name: "Duplicate",
        email: "customer@example.com",
      }).expect(201)
    ).body;
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.matches).toEqual([]);
  });
  it("routes workspace approvals to Ops and client join requests to the Client Super Admin", async () => {
    const newRequest = (
      await post(agent(), "/auth/register-request", {
        requestType: "workspace",
        tenantSlug: "new-client",
        tenantName: "New Client",
        name: "New Admin",
        email: "new@client.test",
        password: pass,
      }).expect(201)
    ).body;
    await post(sales, "/auth/requests/" + newRequest.id + "/approve", {
      seatLimit: 2,
      reference: "AGR-NEW",
    }).expect(403);
    const result = (
      await post(ops, "/auth/requests/" + newRequest.id + "/approve", {
        seatLimit: 2,
        reference: "AGR-NEW",
      }).expect(201)
    ).body;
    expect(result.tenantId).toBeTruthy();
    const client = agent();
    await post(client, "/auth/login", {
      tenantSlug: "new-client",
      email: "new@client.test",
      password: pass,
    }).expect(201);
    expect((await client.get("/api/auth/me")).body.roleCode).toBe(
      "client_super_admin",
    );
    const join = (
      await post(agent(), "/auth/register-request", {
        requestType: "join",
        tenantSlug: "new-client",
        name: "New Rep",
        email: "rep@client.test",
        password: pass,
      }).expect(201)
    ).body;
    await post(ops, "/auth/requests/" + join.id + "/approve", {}).expect(403);
    await post(admin, "/auth/requests/" + join.id + "/approve", {}).expect(403);
    await post(client, "/auth/requests/" + join.id + "/approve", {}).expect(
      201,
    );
    expect((await client.get("/api/users/workspace")).body.active_users).toBe(
      2,
    );
    await agent()
      .get(
        "/api/auth/registration-status?tenantSlug=new-client&email=rep@client.test",
      )
      .expect(400);
  });
  it("enforces license capacity on creation and rejects reductions below active seats", async () => {
    await db.query("UPDATE tenants SET seat_limit=4 WHERE id=$1", [tid]);
    await post(admin, "/users", {
      name: "Over limit",
      email: "extra@acme.test",
      password: pass,
      roleId: roles.sales_member,
    }).expect(409);
    await patch(ops, "/auth/super-admin/tenants/" + tid, {
      seatLimit: 3,
      reference: "AGR-001",
      status: "active",
    }).expect(409);
  });
  it("keeps seat usage within the cap when two account requests compete for the last seat", async () => {
    await db.query("UPDATE tenants SET seat_limit=5 WHERE id=$1", [tid]);
    const results = await Promise.all(
      ["one", "two"].map((x) =>
        post(admin, "/users", {
          name: x,
          email: x + "@acme.test",
          password: pass,
          roleId: roles.sales_member,
        }),
      ),
    );
    expect(results.map((x) => x.status).sort()).toEqual([201, 409]);
    await post(
      admin,
      "/users/" + results.find((x) => x.status === 201)!.body.id + "/remove",
      { replacementId: outsiderId },
    ).expect(201);
    await db.query("UPDATE tenants SET seat_limit=4 WHERE id=$1", [tid]);
  });
  it("validates templates and calculates prices from server commercials; gates approval transitions", async () => {
    const c = (
      await post(admin, "/proposals/commercials", {
        name: "Services",
        currency: "INR",
        taxPct: 18,
        items: [{ description: "CRM consulting", unitPrice: 1000 }],
        terms: "Net 30",
      }).expect(201)
    ).body;
    const t = (await admin.get("/api/proposals/templates")).body[0];
    await post(sales, "/proposals/commercials", { name: "Bad" }).expect(403);
    await post(admin, "/proposals/templates", {
      name: "Invalid",
      bodyHtml: "<h1>{{unknown}}</h1>{{commercial_table}}",
    }).expect(400);
    const p = (
      await post(sales, "/proposals", {
        leadId: lead.id,
        commercialId: c.id,
        templateId: t.id,
        title: "Services",
        items: [{ itemId: c.items[0].id, qty: 2, unitPrice: 1 }],
        discountPct: 20,
        answers: { scope: "<script>alert(1)</script>", timeline: "2 weeks" },
        validUntil: "2099-01-01",
      }).expect(201)
    ).body;
    expect(Number(p.total)).toBe(1888);
    expect(p.status).toBe("approval_required");
    await patch(sales, "/proposals/" + p.id + "/status", {
      status: "sent",
    }).expect(409);
    await patch(sales, "/proposals/" + p.id + "/status", {
      status: "draft",
    }).expect(400);
    await patch(sales, "/proposals/" + p.id + "/status", {
      status: "approved",
    }).expect(403);
    await patch(manager, "/proposals/" + p.id + "/status", {
      status: "approved",
    }).expect(200);
    await patch(sales, "/proposals/" + p.id + "/status", {
      status: "sent",
    }).expect(200);
    await outsider.get("/api/proposals/" + p.id + "/document").expect(404);
    const doc = (
      await sales.get("/api/proposals/" + p.id + "/document").expect(200)
    ).text;
    expect(doc).toContain("&lt;script&gt;");
    expect(doc).not.toContain("<script>");
    await patch(admin, "/proposals/commercials/" + c.id, {
      ...c,
      taxPct: 18,
      items: [{ ...c.items[0], unitPrice: 5000 }],
    }).expect(200);
    expect(Number((await sales.get("/api/proposals/" + p.id)).body.total)).toBe(
      1888,
    );
  });
  it("blocks a manager from approving their own proposal and from exceeding the approval limit", async () => {
    const c = (await admin.get("/api/proposals/commercials")).body[0],
      t = (await admin.get("/api/proposals/templates")).body[0];
    const payload = {
      leadId: lead.id,
      commercialId: c.id,
      templateId: t.id,
      title: "Manager review",
      items: [{ itemId: c.items[0].id, qty: 1 }],
      discountPct: 20,
      answers: { scope: "Standard scope", timeline: "2 weeks" },
      validUntil: "2099-01-01",
    };
    const own = (await post(manager, "/proposals", payload).expect(201)).body;
    await patch(manager, "/proposals/" + own.id + "/status", {
      status: "approved",
    }).expect(403);
    await patch(admin, "/proposals/" + own.id + "/status", {
      status: "approved",
    }).expect(200);
    const high = (
      await post(sales, "/proposals", { ...payload, discountPct: 40 }).expect(
        201,
      )
    ).body;
    await patch(manager, "/proposals/" + high.id + "/status", {
      status: "approved",
    }).expect(403);
    await patch(admin, "/proposals/" + high.id + "/status", {
      status: "rejected",
      note: "Outside policy",
    }).expect(200);
    await patch(sales, "/proposals/" + high.id + "/status", {
      status: "sent",
    }).expect(409);
  });
  it("prevents self approval and limits delegated authority", async () => {
    await patch(manager, "/users/" + salesId + "/authority", {
      selfDiscountPct: 99,
      approveDiscountPct: 0,
      approveTotal: 0,
    }).expect(400);
    await patch(admin, "/users/roles/" + roles.sales_member, {
      permissions: ["*"],
      selfDiscountPct: 10,
      approveDiscountPct: 0,
      approveTotal: 0,
    }).expect(400);
  });
  it("atomically replaces a user at full capacity and revokes the old session", async () => {
    const r = (
      await post(admin, "/users/" + salesId + "/remove", {
        newUser: {
          name: "Replacement",
          email: "replacement@acme.test",
          password: pass,
          roleId: roles.sales_member,
          managerId,
        },
      }).expect(201)
    ).body;
    expect(r.transferredLeads).toBe(1);
    expect(r.transferredTasks).toBe(1);
    expect((await admin.get("/api/users/workspace")).body.active_users).toBe(4);
    await sales.get("/api/auth/me").expect(401);
    const newAgent = agent();
    await post(newAgent, "/auth/login", {
      tenantSlug: "acme",
      email: "replacement@acme.test",
      password: pass,
    }).expect(201);
    await newAgent.get("/api/leads").expect(403);
    await post(newAgent, "/auth/change-password", {
      currentPassword: pass,
      password: pass + "new",
    }).expect(201);
    await post(newAgent, "/auth/login", {
      tenantSlug: "acme",
      email: "replacement@acme.test",
      password: pass + "new",
    }).expect(201);
    expect((await newAgent.get("/api/leads")).body).toHaveLength(1);
  });
  it("enforces PostgreSQL RLS and rejects cross-tenant references at the database layer", async () => {
    const rows = await db.tenant(otherTid, null, (q: any) =>
      q.query("SELECT id FROM leads"),
    );
    expect(rows.rows).toHaveLength(0);
    await expect(
      db.tenant(otherTid, null, (q: any) =>
        q.query("UPDATE users SET manager_id=$2 WHERE tenant_id=$1", [
          otherTid,
          managerId,
        ]),
      ),
    ).rejects.toThrow();
  });
  it("suspends client sessions immediately but permits audited engineer context", async () => {
    await patch(ops, "/auth/super-admin/tenants/" + tid, {
      seatLimit: 4,
      reference: "AGR-001",
      status: "suspended",
    }).expect(200);
    await manager.get("/api/leads").expect(401);
    await post(engineer, "/auth/super-admin/context", { tenantId: tid }).expect(
      201,
    );
    await engineer.get("/api/leads").expect(200);
  });
});
