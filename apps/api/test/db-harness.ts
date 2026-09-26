import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
export async function database() {
  const pg = new PGlite();
  await pg.waitReady;
  await pg.exec("CREATE ROLE crm_app LOGIN");
  const schema = readFileSync(
    resolve(process.cwd(), "db/schema.sql"),
    "utf8",
  ).replace("CREATE EXTENSION IF NOT EXISTS pgcrypto;", "");
  await pg.exec(schema);
  await pg.exec(
    readFileSync(resolve(process.cwd(), "db/migrations/003-lead2.sql"), "utf8"),
  );
  let tail = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const work = tail.then(fn, fn);
    tail = work.then(
      () => {},
      () => {},
    );
    return work;
  };
  const query = async (text: string, params: any[] = []) => {
    const r: any = await pg.query(text, params);
    return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
  };
  const db: any = {
    query: (text: string, params: any[] = []) =>
      serial(async () => {
        await pg.exec("SET ROLE crm_app");
        try {
          return await query(text, params);
        } finally {
          await pg.exec("RESET ROLE");
        }
      }),
    transaction: (fn: any) =>
      serial(async () => {
        await pg.exec("BEGIN; SET LOCAL ROLE crm_app");
        try {
          const out = await fn({ query });
          await pg.exec("COMMIT");
          return out;
        } catch (e) {
          await pg.exec("ROLLBACK");
          throw e;
        }
      }),
    tenant: (tenantId: string, userId: string | null, fn: any) =>
      db.transaction(async (q: any) => {
        await q.query(
          "SELECT set_config('app.current_tenant_id',$1,true),set_config('app.current_user_id',$2,true)",
          [tenantId, userId || ""],
        );
        return fn(q);
      }),
    audit: (
      q: any,
      tenantId: string,
      userId: string,
      action: string,
      type: string,
      id: string,
      metadata: any = {},
    ) =>
      q.query(
        "INSERT INTO audit_logs(tenant_id,user_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5,$6)",
        [tenantId, userId, action, type, id || null, JSON.stringify(metadata)],
      ),
    close: () => pg.close(),
    pg,
  };
  return db;
}
