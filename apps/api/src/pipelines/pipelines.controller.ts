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
import { PipelinesService } from "./pipelines.service";
@UseGuards(AuthGuard)
@Controller("pipelines")
export class PipelinesController {
  constructor(private svc: PipelinesService) {}
  @Get() list(@CurrentUser() u: any) {
    return this.svc.list(u);
  }
  @Post() create(@CurrentUser() u: any, @Body() b: any) {
    return this.svc.create(u, b);
  }
  @Post(":id/stages") addStage(
    @CurrentUser() u: any,
    @Param("id") id: string,
    @Body() b: any,
  ) {
    return this.svc.addStage(u, id, b);
  }
  @Patch("stages/:stageId") editStage(
    @CurrentUser() u: any,
    @Param("stageId") id: string,
    @Body() b: any,
  ) {
    return this.svc.editStage(u, id, b);
  }
}
