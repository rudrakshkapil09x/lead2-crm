import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../common/auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { LeadsService } from "./leads.service";

@UseGuards(AuthGuard)
@Controller("leads")
export class LeadsController {
  constructor(private svc: LeadsService) {}

  @Get() list(@CurrentUser() u: any, @Query() q: any) { return this.svc.list(u, q); }
  @Get("tags") listTags(@CurrentUser() u: any) { return this.svc.listTags(u); }
  @Post("tags") createTag(@CurrentUser() u: any, @Body() b: any) { return this.svc.upsertTag(u, b); }
  @Put("tags/:id") updateTag(@CurrentUser() u: any, @Param("id") id: string, @Body() b: any) { return this.svc.upsertTag(u, b, id); }
  @Get(":id") one(@CurrentUser() u: any, @Param("id") id: string) { return this.svc.one(u, id); }
  @Post("assign") assign(@CurrentUser() u: any, @Body() b: any) { return this.svc.assign(u, b); }
  @Post() create(@CurrentUser() u: any, @Body() b: any) { return this.svc.create(u, b); }
  @Post("import/rows") importRows(@CurrentUser() u: any, @Body() b: any) { return this.svc.importRows(u, b.rows || []); }
  @Patch(":id") update(@CurrentUser() u: any, @Param("id") id: string, @Body() b: any) { return this.svc.update(u, id, b); }
  @Post(":id/activities") activity(@CurrentUser() u: any, @Param("id") id: string, @Body() b: any) { return this.svc.addActivity(u, id, b); }
  @Put(":id/tags") setTags(@CurrentUser() u: any, @Param("id") id: string, @Body() b: any) { return this.svc.setLeadTags(u, id, b.tagIds || []); }
  @Delete(":id") remove(@CurrentUser() u: any, @Param("id") id: string) { return this.svc.remove(u, id); }
}

