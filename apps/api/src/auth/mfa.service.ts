import { Injectable } from "@nestjs/common";
import * as OTPLib from "otplib";
import * as qrcode from "qrcode";

// otplib exposes authenticator via the named export or default
const { authenticator } = (OTPLib as any).default ?? OTPLib;


@Injectable()
export class MfaService {
  generateSecret(email: string, issuer = "Lead2 CRM") {
    const secret = authenticator.generateSecret(20);
    const otpAuthUrl = authenticator.keyuri(email, issuer, secret);
    return { secret, otpAuthUrl };
  }

  async generateQrDataUrl(otpAuthUrl: string): Promise<string> {
    return qrcode.toDataURL(otpAuthUrl);
  }

  verify(secret: string, token: string): boolean {
    try {
      return authenticator.verify({ token, secret });
    } catch {
      return false;
    }
  }
}
