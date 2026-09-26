import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { MfaService } from "./mfa.service";
import { GoogleStrategy } from "./google.strategy";

@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [AuthService, MfaService, GoogleStrategy],
  exports: [AuthService, MfaService],
})
export class AuthModule {}
