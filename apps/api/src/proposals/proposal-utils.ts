import { BadRequestException } from "@nestjs/common";
import Decimal from "decimal.js";
import sanitizeHtml from "sanitize-html";
import * as v from "../common/validation";
export const RESERVED = [
  "proposal_title",
  "proposal_number",
  "proposal_date",
  "valid_until",
  "client_name",
  "company_name",
  "seller_name",
  "commercial_table",
  "subtotal",
  "discount",
  "tax",
  "total",
  "terms",
  "currency",
];
export function escapeHtml(value: any) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (x) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        x
      ]!,
  );
}
export function sanitizeTemplate(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [
      "h1",
      "h2",
      "h3",
      "h4",
      "p",
      "br",
      "hr",
      "div",
      "span",
      "strong",
      "em",
      "b",
      "i",
      "u",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "td",
      "th",
      "ul",
      "ol",
      "li",
      "blockquote",
    ],
    allowedAttributes: {
      "*": ["style"],
      td: ["colspan", "rowspan", "style"],
      th: ["colspan", "rowspan", "style"],
    },
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-f]{3,8}$/i],
        "background-color": [/^#[0-9a-f]{3,8}$/i],
        "text-align": [/^(left|right|center)$/],
        "font-weight": [/^(normal|bold|[1-9]00)$/],
      },
    },
  });
}
export function questions(input: any) {
  if (!Array.isArray(input) || input.length > 12)
    throw new BadRequestException("Use at most 12 template questions");
  const used = new Set<string>();
  return input.map((x: any) => {
    const key = v.str(x.key, "Question key", 30);
    if (
      !/^[a-z][a-z0-9_]*$/.test(key) ||
      RESERVED.includes(key) ||
      used.has(key)
    )
      throw new BadRequestException(
        "Use unique question keys with lowercase letters, numbers and underscores",
      );
    used.add(key);
    return {
      key,
      label: v.str(x.label, "Question label", 160),
      required: x.required !== false,
    };
  });
}
export function validateTemplate(html: string, qs: any[]) {
  if (!html.includes("{{commercial_table}}"))
    throw new BadRequestException(
      "Include {{commercial_table}} where the pricing table should appear",
    );
  const keys = new Set([...RESERVED, ...qs.map((x) => x.key)]);
  for (const m of html.matchAll(/{{\s*([^{}]+?)\s*}}/g))
    if (!keys.has(m[1]))
      throw new BadRequestException(`Unknown placeholder: ${m[1]}`);
  return html;
}
export function calculate(catalog: any, selected: any, discountInput: any) {
  if (!Array.isArray(selected) || !selected.length || selected.length > 100)
    throw new BadRequestException("Select 1–100 commercial items");
  const seen = new Set<string>();
  const items = selected.map((x: any) => {
    const product = catalog.items.find((p: any) => p.id === x.itemId);
    if (!product || seen.has(x.itemId))
      throw new BadRequestException(
        "Choose unique items from the selected commercial",
      );
    seen.add(x.itemId);
    const qty = v.num(x.qty, "Quantity", 0.01, 100000);
    const amount = new Decimal(product.unitPrice).mul(qty).toDecimalPlaces(2);
    return {
      itemId: product.id,
      description: product.description,
      unit: product.unit,
      qty,
      unitPrice: Number(product.unitPrice),
      amount: amount.toNumber(),
    };
  });
  const discountPct = v.num(discountInput ?? 0, "Discount", 0, 100),
    taxPct = v.num(catalog.tax_pct, "Tax", 0, 100);
  const subtotal = items
      .reduce((s: Decimal, x: any) => s.plus(x.amount), new Decimal(0))
      .toDecimalPlaces(2),
    discount = subtotal.mul(discountPct).div(100).toDecimalPlaces(2),
    net = subtotal.minus(discount),
    tax = net.mul(taxPct).div(100).toDecimalPlaces(2),
    total = net.plus(tax);
  v.num(total.toNumber(), "Proposal total", 0, 999999999999);
  return {
    items,
    subtotal: subtotal.toNumber(),
    discount: discount.toNumber(),
    discountPct,
    tax: tax.toNumber(),
    taxPct,
    total: total.toNumber(),
  };
}
export function renderProposal(p: any, workspace: string) {
  const s = p.snapshot || {},
    money = (x: any) =>
      `${escapeHtml(p.currency)} ${Number(x || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const table = `<table><thead><tr><th>Product / service</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${p.items.map((i: any) => `<tr><td>${escapeHtml(i.description)}<br><small>${escapeHtml(i.unit || "")}</small></td><td>${escapeHtml(i.qty)}</td><td>${money(i.unitPrice)}</td><td>${money(i.amount ?? i.qty * i.unitPrice)}</td></tr>`).join("")}</tbody></table><div class="totals"><p>Subtotal <b>${money(p.subtotal)}</b></p><p>Discount (${escapeHtml(p.discount_pct)}%) <b>− ${money(s.calculation?.discount)}</b></p><p>Tax (${escapeHtml(p.tax_pct)}%) <b>${money(s.calculation?.tax)}</b></p><p class="total">Total <b>${money(p.total)}</b></p></div>`;
  const values: any = {
    proposal_title: p.title,
    proposal_number: "L2-" + p.id.slice(0, 8).toUpperCase(),
    proposal_date: new Date(p.created_at).toISOString().slice(0, 10),
    valid_until: p.valid_until
      ? new Date(p.valid_until).toISOString().slice(0, 10)
      : "—",
    client_name: s.lead?.name || p.lead_name,
    company_name: s.lead?.company || "",
    seller_name: s.sellerName || workspace,
    subtotal: money(p.subtotal),
    discount: money(s.calculation?.discount),
    tax: money(s.calculation?.tax),
    total: money(p.total),
    terms: p.terms,
    currency: p.currency,
    ...s.answers,
  };
  const html = (
    s.template?.body_html ||
    "<h1>{{proposal_title}}</h1>{{commercial_table}}<p>{{terms}}</p>"
  ).replace(/{{\s*([^{}]+?)\s*}}/g, (_: string, key: string) =>
    key === "commercial_table"
      ? table
      : escapeHtml(values[key] || "").replace(/\n/g, "<br>"),
  );
  const banner = ["draft", "approval_required", "rejected"].includes(p.status)
    ? `<div class="draft">${p.status === "approval_required" ? "Pending approval · Not authorized for sending" : p.status === "rejected" ? "Rejected · Not authorized for sending" : "Draft · For review"}</div>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(p.title)}</title><style>body{font-family:Arial,sans-serif;color:#173c3b;max-width:850px;margin:48px auto;padding:0 32px;font-size:14px;line-height:1.7}header{display:flex;justify-content:space-between;border-bottom:2px solid #1c7364;padding-bottom:20px;margin-bottom:32px}h1{font-size:32px;line-height:1.2}h2{font-size:18px;margin-top:30px}table{width:100%;border-collapse:collapse;margin:24px 0}th{text-align:left;background:#edf5f2}td,th{padding:12px;border-bottom:1px solid #d8e5df;vertical-align:top}.totals{margin-left:auto;max-width:330px}.totals p{display:flex;justify-content:space-between}.total{border-top:2px solid #1c7364;font-size:20px;padding-top:14px}.draft{padding:10px;background:#fff2da;color:#835d16;margin:16px 0}footer{border-top:1px solid #ddd;margin-top:40px;padding-top:15px;font-size:11px;color:#677674}tr{break-inside:avoid}@page{size:A4;margin:18mm}@media print{body{margin:0;padding:0;max-width:none}h2{break-after:avoid}}</style></head><body><header><strong>${escapeHtml(s.sellerName || workspace)}</strong><span>Powered by Lead2 CRM</span></header>${banner}${html}<footer>Proposal ${escapeHtml(values.proposal_number)} · ${escapeHtml(p.currency)} · Pricing and template snapshot preserved at generation.</footer></body></html>`;
}
