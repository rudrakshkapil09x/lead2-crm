import "reflect-metadata";
import "./config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { configureApp } from "./common/http";
async function bootstrap() {
  for (const key of [
    "DATABASE_URL",
    "JWT_SECRET",
    "FIELD_ENCRYPTION_KEY",
    "CONTACT_HASH_KEY",
  ])
    if (!process.env[key])
      throw new Error(
        `${key} is required; run the environment generator first`,
      );
  if (
    process.env.JWT_SECRET!.length < 32 ||
    !/^[0-9a-f]{64}$/i.test(process.env.FIELD_ENCRYPTION_KEY!)
  )
    throw new Error("Invalid application secrets");
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  configureApp(app);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 4000), "0.0.0.0");
  console.log("Lead2 CRM API ready");
}
bootstrap().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
