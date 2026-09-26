import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { MfaService } from "./mfa.service";
import { GoogleStrategy } from "./google.strategy";
import { CryptoService } from "../common/crypto.service";

@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [AuthService, MfaService, GoogleStrategy, CryptoService],
  exports: [AuthService, MfaService],
})
export class AuthModule {}
