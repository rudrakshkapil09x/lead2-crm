import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, VerifyCallback } from "passport-google-oauth20";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || "GOOGLE_CLIENT_ID_NOT_SET",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "GOOGLE_CLIENT_SECRET_NOT_SET",
      callbackURL: `${process.env.APP_BASE_URL || "http://localhost:4000"}/api/auth/google/callback`,
      scope: ["email", "profile"],
      passReqToCallback: true,
    });
  }

  // workspace slug passed as OAuth state
  authenticate(req: any, options: any) {
    options = { ...options, state: req.query?.slug || "" };
    super.authenticate(req, options);
  }

  async validate(
    req: any,
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    const email = profile.emails?.[0]?.value;
    const name = profile.displayName;
    const slug = req.query?.state || "";
    done(null, { email, name, slug, googleId: profile.id });
  }
}
