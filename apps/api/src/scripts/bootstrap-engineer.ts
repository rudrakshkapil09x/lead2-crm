import "../config";
import { Pool } from "pg";
import * as bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { email, password, str } from "../common/validation";
async function main() {
  const name = str(process.env.ENGINEER_NAME || "Lead2 Engineer", "Name", 120),
    address = email(process.env.ENGINEER_EMAIL),
    pw = password(readFileSync(0, "utf8").replace(/\r?\n$/, ""));
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(7283421)");
    const existing = await client.query(
      "SELECT id FROM platform_admins WHERE role='lead2_engineer'",
    );
    if (existing.rowCount && !process.argv.includes("--additional"))
      throw new Error(
        "An engineer already exists. Only a system operator may provision another with --additional.",
      );
    const hash = await bcrypt.hash(pw, 12);
    const r = await client.query(
      "INSERT INTO platform_admins(name,email,password_hash,role) VALUES($1,$2,$3,'lead2_engineer') RETURNING id",
      [name, address, hash],
    );
    await client.query(
      "INSERT INTO platform_audit_logs(actor_id,action,metadata) VALUES($1,'engineer.provisioned',$2)",
      [r.rows[0].id, JSON.stringify({ method: "operator_cli" })],
    );
    await client.query("COMMIT");
    console.log("Lead2 Engineer provisioned. Sign in at /super-admin/login.");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
