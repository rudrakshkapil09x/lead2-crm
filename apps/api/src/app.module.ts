import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { DbModule } from "./db/db.module";
import { AuthModule } from "./auth/auth.module";
import { LeadsModule } from "./leads/leads.module";
import { PipelinesModule } from "./pipelines/pipelines.module";
import { TasksModule } from "./tasks/tasks.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { UsersModule } from "./users/users.module";
import { ProposalsModule } from "./proposals/proposals.module";
import { CommonModule } from "./common/common.module";
import { MailModule } from "./mail/mail.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { HealthController } from "./health/health.controller";

@Module({
  controllers: [HealthController],
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || "dev-only-secret-change-me",
    }),
    DbModule,
    CommonModule,
    MailModule,      // global — available everywhere
    WebhooksModule,  // global webhook dispatcher
    AuthModule,
    LeadsModule,
    PipelinesModule,
    TasksModule,
    DashboardModule,
    UsersModule,
    ProposalsModule,
  ],
})
export class AppModule {}
