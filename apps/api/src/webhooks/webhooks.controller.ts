import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { WebhooksService } from "./webhooks.service";
import { AuthGuard } from "../common/auth.guard";
import { CurrentUser } from "../common/current-user.decorator";

@UseGuards(AuthGuard)
@Controller("webhooks")
export class WebhooksController {
  constructor(private svc: WebhooksService) {}

  @Get() list(@CurrentUser() u: any) { return this.svc.list(u); }
  @Post() create(@CurrentUser() u: any, @Body() b: any) { return this.svc.upsert(u, b); }
  @Put(":id") update(@CurrentUser() u: any, @Param("id") id: string, @Body() b: any) { return this.svc.upsert(u, b, id); }
  @Delete(":id") remove(@CurrentUser() u: any, @Param("id") id: string) { return this.svc.remove(u, id); }
  @Get(":id/deliveries") deliveries(@CurrentUser() u: any, @Param("id") id: string) { return this.svc.deliveries(u, id); }
}
