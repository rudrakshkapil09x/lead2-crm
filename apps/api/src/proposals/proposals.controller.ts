import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { AuthGuard } from "../common/auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { ProposalsService } from "./proposals.service";
import { PdfService } from "./pdf.service";

@UseGuards(AuthGuard)
@Controller("proposals")
export class ProposalsController {
  constructor(
    private svc: ProposalsService,
    private pdfSvc: PdfService,
  ) {}

  @Get() list(@CurrentUser() u: any) {
    return this.svc.list(u);
  }
  @Get("commercials") catalogs(@CurrentUser() u: any) {
    return this.svc.catalogs(u);
  }
  @Post("commercials") createCatalog(@CurrentUser() u: any, @Body() b: any) {
    return this.svc.saveCatalog(u, b);
  }
  @Patch("commercials/:id") editCatalog(
    @CurrentUser() u: any,
    @Param("id") id: string,
    @Body() b: any,
  ) {
    return this.svc.saveCatalog(u, b, id);
  }
  @Get("templates") templates(@CurrentUser() u: any) {
    return this.svc.templates(u);
  }
  @Post("templates") createTemplate(@CurrentUser() u: any, @Body() b: any) {
    return this.svc.saveTemplate(u, b);
  }
  @Patch("templates/:id") editTemplate(
    @CurrentUser() u: any,
    @Param("id") id: string,
    @Body() b: any,
  ) {
    return this.svc.saveTemplate(u, b, id);
  }
  @Post() create(@CurrentUser() u: any, @Body() b: any) {
    return this.svc.create(u, b);
  }
  @Get(":id") one(@CurrentUser() u: any, @Param("id") id: string) {
    return this.svc.one(u, id);
  }
  @Patch(":id/status") status(
    @CurrentUser() u: any,
    @Param("id") id: string,
    @Body() b: any,
  ) {
    return this.svc.status(u, id, b);
  }
  @Get(":id/document") async document(
    @CurrentUser() u: any,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const html = await this.svc.document(u, id);
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
    );
    res.type("html").send(html);
  }
  
  @Get(":id/pdf") async generatePdf(
    @CurrentUser() u: any,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const html = await this.svc.document(u, id);
    const pdfBuffer = await this.pdfSvc.generatePdf(html);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="proposal-${id}.pdf"`);
    res.send(pdfBuffer);
  }
}
