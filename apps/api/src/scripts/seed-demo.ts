import "../config";
import { DbService } from "../db/db.service";
import { demoData } from "./demo-data";
import { password } from "../common/validation";
async function main() {
  if (
    process.env.ALLOW_DEMO_SEED !== "true" ||
    process.env.NODE_ENV === "production"
  )
    throw new Error(
      "Demo seeding requires ALLOW_DEMO_SEED=true in a non-production environment",
    );
  const db = new DbService();
  try {
    await demoData(db, password(process.env.DEMO_PASSWORD));
    console.log(
      "Demo workspace lead2-demo created. Demo emails are listed in README.md.",
    );
  } finally {
    await db.onModuleDestroy();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
