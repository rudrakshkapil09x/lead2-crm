import { Module } from "@nestjs/common";
import { ProposalsController } from "./proposals.controller";
import { ProposalsService } from "./proposals.service";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { PdfService } from "./pdf.service";

@Module({
  imports: [WebhooksModule],
  controllers: [ProposalsController],
  providers: [ProposalsService, PdfService],
})
export class ProposalsModule {}
