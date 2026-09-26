import { CryptoService } from "../src/common/crypto.service";
describe("CryptoService", () => {
  beforeAll(() => {
    process.env.FIELD_ENCRYPTION_KEY = "11".repeat(32);
    process.env.CONTACT_HASH_KEY = "test-contact-secret";
  });
  it("round-trips encrypted PII without storing plaintext", () => {
    const c = new CryptoService();
    const value = "+91 98765 43210";
    const enc = c.encrypt(value)!;
    expect(enc).not.toContain("98765");
    expect(c.decrypt(enc)).toBe(value);
  });
  it("normalizes duplicate contact keys", () => {
    const c = new CryptoService();
    expect(c.contactHash("+91 98765-43210")).toBe(
      c.contactHash("+919876543210"),
    );
  });
});
