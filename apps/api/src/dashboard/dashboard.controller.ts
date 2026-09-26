import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../common/auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { DashboardService } from "./dashboard.service";
@UseGuards(AuthGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(private svc: DashboardService) {}
  @Get() get(@CurrentUser() u: any) {
    return this.svc.get(u);
  }
}
