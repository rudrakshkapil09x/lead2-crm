// Local-only, disposable demo. Uses the same API, RLS schema, and permission checks.
import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { DbService } from "../src/db/db.service";
import { configureApp } from "../src/common/http";
import { database } from "./db-harness";
import { demoData } from "../src/scripts/demo-data";
async function start() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Disposable demo cannot run in production");
  process.env.NODE_ENV = "test";
  process.env.FIELD_ENCRYPTION_KEY = "a".repeat(64);
  process.env.CONTACT_HASH_KEY = "lead2-local-demo-contact-hash";
  const db = await database();
  await demoData(db, "Lead2-Demo-2026!");
  const m = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DbService)
    .useValue(db)
    .compile();
  const app = m.createNestApplication({ bodyParser: false });
  configureApp(app);
  await app.listen(4000, "127.0.0.1");
  console.log("Disposable Lead2 demo API ready at http://127.0.0.1:4000");
  process.on("SIGTERM", async () => {
    await app.close();
    await db.close();
    process.exit(0);
  });
}
start().catch((e) => {
  console.error(e);
  process.exit(1);
});
