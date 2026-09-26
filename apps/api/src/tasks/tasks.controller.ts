import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../common/auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { TasksService } from "./tasks.service";
@UseGuards(AuthGuard)
@Controller("tasks")
export class TasksController {
  constructor(private svc: TasksService) {}
  @Get() list(@CurrentUser() u: any, @Query() q: any) {
    return this.svc.list(u, q);
  }
  @Post() create(@CurrentUser() u: any, @Body() b: any) {
    return this.svc.create(u, b);
  }
  @Patch(":id/complete") complete(
    @CurrentUser() u: any,
    @Param("id") id: string,
  ) {
    return this.svc.complete(u, id);
  }
}
