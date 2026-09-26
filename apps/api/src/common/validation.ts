import { BadRequestException } from "@nestjs/common";
export function str(v: any, label: string, max = 200, required = true) {
  if (typeof v !== "string") {
    if (!required && (v === null || v === undefined)) return "";
    throw new BadRequestException(`${label} must be text`);
  }
  const s = v.trim();
  if (s.length > max || (required && !s))
    throw new BadRequestException(
      `${label} must contain ${required ? "1" : "0"}–${max} characters`,
    );
  return s;
}
export function email(v: any) {
  const s = str(v, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
    throw new BadRequestException("Enter a valid email");
  return s;
}
export function password(v: any) {
  if (typeof v !== "string" || v.length < 12 || Buffer.byteLength(v) > 72)
    throw new BadRequestException(
      "Use a password of at least 12 characters and at most 72 UTF-8 bytes",
    );
  return v;
}
export function num(v: any, label: string, min = 0, max = 999999999999) {
  if (
    v === null ||
    v === "" ||
    !["string", "number"].includes(typeof v) ||
    !Number.isFinite(Number(v)) ||
    Number(v) < min ||
    Number(v) > max
  )
    throw new BadRequestException(`${label} must be between ${min} and ${max}`);
  return Number(v);
}
export function integer(v: any, label: string, min = 0, max = 100000) {
  const n = num(v, label, min, max);
  if (!Number.isInteger(n))
    throw new BadRequestException(`${label} must be a whole number`);
  return n;
}
export function date(v: any, label: string, optional = true) {
  if (!v && optional) return null;
  if (
    typeof v !== "string" ||
    !/^\d{4}-\d{2}-\d{2}/.test(v) ||
    !Number.isFinite(Date.parse(v))
  )
    throw new BadRequestException(`${label} must be a valid date`);
  return v;
}
export const CURRENCIES = [
  "INR",
  "USD",
  "EUR",
  "GBP",
  "AED",
  "SGD",
  "AUD",
  "CAD",
];
export function currency(v: any) {
  if (!CURRENCIES.includes(v))
    throw new BadRequestException(`Currency must be ${CURRENCIES.join(", ")}`);
  return v;
}
export function uuid(v: any, label = "ID") {
  if (
    typeof v !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  )
    throw new BadRequestException(`${label} is invalid`);
  return v;
}
