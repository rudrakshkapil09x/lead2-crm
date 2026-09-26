import { Injectable } from "@nestjs/common";
import crypto from "node:crypto";
@Injectable()
export class CryptoService {
  private key = this.loadKey();
  private hashKey =
    process.env.CONTACT_HASH_KEY || "dev-contact-hash-key-change-me";
  private loadKey() {
    const raw = process.env.FIELD_ENCRYPTION_KEY;
    if (raw && /^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
    return crypto
      .createHash("sha256")
      .update(raw || "dev-field-key-change-me")
      .digest();
  }
  encrypt(value?: string | null) {
    if (!value) return null;
    const iv = crypto.randomBytes(12),
      cipher = crypto.createCipheriv("aes-256-gcm", this.key, iv);
    const enc = Buffer.concat([
      cipher.update(value.trim(), "utf8"),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url");
  }
  decrypt(payload?: string | null) {
    if (!payload) return null;
    const b = Buffer.from(payload, "base64url"),
      iv = b.subarray(0, 12),
      tag = b.subarray(12, 28),
      enc = b.subarray(28);
    const d = crypto.createDecipheriv("aes-256-gcm", this.key, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
  }
  contactHash(value?: string | null) {
    if (!value) return null;
    const normalized = value.toLowerCase().replace(/[\s()+.\-]/g, "");
    return crypto
      .createHmac("sha256", this.hashKey)
      .update(normalized)
      .digest("hex");
  }
}
