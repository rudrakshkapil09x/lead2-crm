import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../common/auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { UsersService } from "./users.service";
@UseGuards(AuthGuard)
@Controller("users")
export class UsersController {
  constructor(private svc: UsersService) {}
  @Get() list(@CurrentUser() u: any) {
    return this.svc.list(u);
  }
  @Get("roles") roles(@CurrentUser() u: any) {
    return this.svc.roles(u);
  }
  @Get("workspace") workspace(@CurrentUser() u: any) {
    return this.svc.workspace(u);
  }
  @Get("audit") audit(@CurrentUser() u: any) {
    return this.svc.audit(u);
  }
  @Post() create(@CurrentUser() u: any, @Body() b: any) {
    return this.svc.create(u, b);
  }
  @Patch("roles/:id") authority(
    @CurrentUser() u: any,
    @Param("id") id: string,
    @Body() b: any,
  ) {
    return this.svc.authority(u, id, b);
  }
  @Patch(":id") update(
    @CurrentUser() u: any,
    @Param("id") id: string,
    @Body() b: any,
  ) {
    return this.svc.update(u, id, b);
  }
  @Post(":id/remove") remove(
    @CurrentUser() u: any,
    @Param("id") id: string,
    @Body() b: any,
  ) {
    return this.svc.remove(u, id, b);
  }
  @Patch(":id/reporting") reporting(
    @CurrentUser() u: any,
    @Param("id") id: string,
    @Body() b: any,
  ) {
    return this.svc.reporting(u, id, b);
  }
  @Patch(":id/authority") teamAuthority(
    @CurrentUser() u: any,
    @Param("id") id: string,
    @Body() b: any,
  ) {
    return this.svc.teamAuthority(u, id, b);
  }
}
