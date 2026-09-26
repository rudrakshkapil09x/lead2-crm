import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard as PassportAuthGuard } from "@nestjs/passport";
import { Response, Request } from "express";
import { AuthService } from "./auth.service";
import { AuthGuard } from "../common/auth.guard";
import { CurrentUser } from "../common/current-user.decorator";

const REFRESH_COOKIE = "lead2_refresh";

function setSessionCookies(res: Response, r: { accessToken: string; refreshToken?: string }) {
  res.cookie("lead2_session", r.accessToken, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/api",
    maxAge: 4 * 60 * 60 * 1000, // 4h
  });
  if (r.refreshToken) {
    res.cookie(REFRESH_COOKIE, r.refreshToken, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
      path: "/api/auth/refresh",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
  }
  return { ok: true };
}

@Controller("auth")
export class AuthController {
  constructor(private svc: AuthService) {}

  // ─── Registration ────────────────────────────────────────────────────────────
  @Post("register-request") register(@Body() b: any) {
    return this.svc.registerRequest(b);
  }
  @Get("registration-status") status(@Query() b: any) {
    return this.svc.registrationStatus(b);
  }

  // ─── Login ───────────────────────────────────────────────────────────────────
  @Post("login") async login(
    @Body() b: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const r = await this.svc.login(b);
    if ("mfaRequired" in r) return r; // step-up needed
    return setSessionCookies(res, r as any);
  }

  @Post("super-admin/login") async platformLogin(
    @Body() b: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const r = await this.svc.login(b, true);
    if ("mfaRequired" in r) return r;
    return setSessionCookies(res, r as any);
  }

  // ─── MFA ─────────────────────────────────────────────────────────────────────
  @Post("mfa/verify") async mfaVerify(
    @Body() b: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    return setSessionCookies(res, await this.svc.verifyMfa(b));
  }
  @UseGuards(AuthGuard) @Get("mfa/setup") mfaSetup(@CurrentUser() u: any) {
    return this.svc.setupMfa(u);
  }
  @UseGuards(AuthGuard) @Post("mfa/enable") mfaEnable(@CurrentUser() u: any, @Body() b: any) {
    return this.svc.enableMfa(u, b);
  }
  @UseGuards(AuthGuard) @Post("mfa/disable") mfaDisable(@CurrentUser() u: any, @Body() b: any) {
    return this.svc.disableMfa(u, b);
  }

  // ─── JWT Refresh (BUG-12) ────────────────────────────────────────────────────
  @Post("refresh") async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new Error("No refresh token");
    const r = await this.svc.refresh(token);
    return setSessionCookies(res, r);
  }

  // ─── Password Reset (BUG-03) ─────────────────────────────────────────────────
  @Post("forgot-password") forgotPassword(@Body() b: any) {
    return this.svc.forgotPassword(b);
  }
  @Post("reset-password") resetPassword(@Body() b: any) {
    return this.svc.resetPassword(b);
  }

  // ─── Google SSO ──────────────────────────────────────────────────────────────
  @Get("google")
  @UseGuards(PassportAuthGuard("google"))
  googleAuth() { /* redirect handled by passport */ }

  @Get("google/callback")
  @UseGuards(PassportAuthGuard("google"))
  async googleCallback(
    @Req() req: any,
    @Res() res: Response,
  ) {
    try {
      const { accessToken, refreshToken } = await this.svc.googleLogin(req.user);
      res.cookie("lead2_session", accessToken, {
        httpOnly: true,
        secure: process.env.COOKIE_SECURE === "true",
        sameSite: "lax",
        path: "/api",
        maxAge: 4 * 60 * 60 * 1000,
      });
      res.cookie(REFRESH_COOKIE, refreshToken, {
        httpOnly: true,
        secure: process.env.COOKIE_SECURE === "true",
        sameSite: "lax",
        path: "/api/auth/refresh",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
      const base = process.env.APP_BASE_URL || "http://localhost:3000";
      res.redirect(`${base}/dashboard`);
    } catch {
      const base = process.env.APP_BASE_URL || "http://localhost:3000";
      res.redirect(`${base}/login?error=google_failed`);
    }
  }

  // ─── Session ─────────────────────────────────────────────────────────────────
  @UseGuards(AuthGuard) @Get("me") me(@CurrentUser() u: any) { return u; }

  @UseGuards(AuthGuard) @Post("logout") async logout(
    @CurrentUser() u: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.svc.logout(u);
    res.clearCookie("lead2_session", { path: "/api" });
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth/refresh" });
    return { ok: true };
  }

  @UseGuards(AuthGuard) @Post("change-password") async password(
    @CurrentUser() u: any,
    @Body() b: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.svc.changePassword(u, b);
    res.clearCookie("lead2_session", { path: "/api" });
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth/refresh" });
    return { ok: true };
  }

  // ─── Access requests ─────────────────────────────────────────────────────────
  @UseGuards(AuthGuard) @Get(["requests", "super-admin/requests"]) requests(
    @CurrentUser() u: any, @Query("status") s?: string,
  ) { return this.svc.requests(u, s); }

  @UseGuards(AuthGuard)
  @Post(["requests/:id/approve", "super-admin/requests/:id/approve"])
  approve(@CurrentUser() u: any, @Param("id") id: string, @Body() b: any) {
    return this.svc.approve(u, id, b);
  }

  @UseGuards(AuthGuard)
  @Post(["requests/:id/reject", "super-admin/requests/:id/reject"])
  reject(@CurrentUser() u: any, @Param("id") id: string, @Body() b: any) {
    return this.svc.reject(u, id, b);
  }

  // ─── Platform admin ──────────────────────────────────────────────────────────
  @UseGuards(AuthGuard) @Get("super-admin/summary") summary(@CurrentUser() u: any) {
    return this.svc.platformSummary(u);
  }
  @UseGuards(AuthGuard) @Patch("super-admin/tenants/:id") tenant(
    @CurrentUser() u: any, @Param("id") id: string, @Body() b: any,
  ) { return this.svc.updateTenant(u, id, b); }
  @UseGuards(AuthGuard) @Get("super-admin/staff") staff(@CurrentUser() u: any) {
    return this.svc.staff(u);
  }
  @UseGuards(AuthGuard) @Post("super-admin/staff") ops(@CurrentUser() u: any, @Body() b: any) {
    return this.svc.createOps(u, b);
  }
  @UseGuards(AuthGuard) @Patch("super-admin/staff/:id") updateOps(
    @CurrentUser() u: any, @Param("id") id: string, @Body() b: any,
  ) { return this.svc.updateOps(u, id, b); }
  @UseGuards(AuthGuard) @Post("super-admin/context") async context(
    @CurrentUser() u: any, @Body() b: any, @Res({ passthrough: true }) res: Response,
  ) {
    return setSessionCookies(res, await this.svc.context(u, b.tenantId));
  }
  @UseGuards(AuthGuard) @Get("super-admin/audit") audit(@CurrentUser() u: any) {
    return this.svc.platformAudit(u);
  }
}
