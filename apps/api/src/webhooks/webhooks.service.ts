import { Injectable, Logger } from "@nestjs/common";
import { DbService } from "../db/db.service";
import * as crypto from "node:crypto";
import * as https from "node:https";
import * as http from "node:http";
import * as dns from "node:dns/promises";
import * as net from "node:net";
import * as v from "../common/validation";
import { requirePermission } from "../common/permissions";

// ─── SSRF Blocklist ────────────────────────────────────────────────────────────
// Blocks all private/reserved IP ranges to prevent Server-Side Request Forgery.
// An attacker with super-admin access could otherwise reach internal services
// (e.g. AWS EC2 metadata at 169.254.169.254, VPC hosts, localhost).
const BLOCKED_CIDRS: Array<{ base: bigint; mask: bigint; label: string }> = [
  // Loopback (127.0.0.0/8)
  { base: ip4ToBigInt("127.0.0.0"), mask: cidrMask(8), label: "loopback" },
  // Link-local / AWS metadata (169.254.0.0/16)
  { base: ip4ToBigInt("169.254.0.0"), mask: cidrMask(16), label: "link-local" },
  // Private Class A (10.0.0.0/8)
  { base: ip4ToBigInt("10.0.0.0"), mask: cidrMask(8), label: "RFC-1918 Class A" },
  // Private Class B (172.16.0.0/12)
  { base: ip4ToBigInt("172.16.0.0"), mask: cidrMask(12), label: "RFC-1918 Class B" },
  // Private Class C (192.168.0.0/16)
  { base: ip4ToBigInt("192.168.0.0"), mask: cidrMask(16), label: "RFC-1918 Class C" },
  // Reserved / documentation (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24)
  { base: ip4ToBigInt("192.0.2.0"), mask: cidrMask(24), label: "documentation" },
  { base: ip4ToBigInt("198.51.100.0"), mask: cidrMask(24), label: "documentation" },
  { base: ip4ToBigInt("203.0.113.0"), mask: cidrMask(24), label: "documentation" },
  // Shared address space (100.64.0.0/10)
  { base: ip4ToBigInt("100.64.0.0"), mask: cidrMask(10), label: "shared-address" },
];

function ip4ToBigInt(ip: string): bigint {
  const parts = ip.split(".").map(Number);
  return (BigInt(parts[0]) << 24n) | (BigInt(parts[1]) << 16n) | (BigInt(parts[2]) << 8n) | BigInt(parts[3]);
}

function cidrMask(bits: number): bigint {
  return ((1n << BigInt(bits)) - 1n) << BigInt(32 - bits);
}

function isPrivateIPv4(ip: string): boolean {
  if (!net.isIPv4(ip)) return false; // IPv6 — block by default (not needed for webhooks)
  const addr = ip4ToBigInt(ip);
  return BLOCKED_CIDRS.some(({ base, mask }) => (addr & mask) === (base & mask));
}

/** Resolve hostname and check all resulting IPs against the SSRF blocklist. Throws if any IP is blocked. */
async function validateWebhookUrl(url: string): Promise<void> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error("Invalid webhook URL");
  }

  // Block bare IP literals immediately
  if (net.isIP(hostname)) {
    if (isPrivateIPv4(hostname) || !net.isIPv4(hostname))
      throw new Error(`Webhook URL resolves to a blocked address (${hostname}). Use a public HTTPS endpoint.`);
    return;
  }

  // Resolve all A records and check each
  let addrs: string[] = [];
  try {
    addrs = await dns.resolve4(hostname);
  } catch {
    throw new Error(`Could not resolve webhook hostname: ${hostname}`);
  }

  if (!addrs.length) throw new Error(`Webhook hostname ${hostname} has no IPv4 addresses`);

  for (const ip of addrs) {
    if (isPrivateIPv4(ip))
      throw new Error(
        `Webhook URL resolves to a private/internal IP (${ip}). Use a public HTTPS endpoint.`,
      );
  }
}
// ──────────────────────────────────────────────────────────────────────────────

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private db: DbService) {}

  /** Create or update a webhook endpoint */
  async upsert(u: any, b: any, id?: string) {
    requirePermission(u, "user.manage"); // super-admin only
    const url = v.str(b.url, "Webhook URL", 500);
    if (!/^https?:\/\//i.test(url)) throw new Error("URL must start with http:// or https://");

    // SSRF protection: validate URL before storing
    await validateWebhookUrl(url);

    const events: string[] = Array.isArray(b.events) ? b.events : [];
    const validEvents = ["lead.created","lead.stage_changed","proposal.approved","proposal.sent","proposal.rejected","task.completed"];
    if (events.some((e) => !validEvents.includes(e))) throw new Error(`Invalid event. Allowed: ${validEvents.join(", ")}`);
    const secret = b.secret || crypto.randomBytes(24).toString("hex");
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      if (id) {
        const r = await q.query("UPDATE webhook_endpoints SET url=$3,events=$4,secret=$5,active=$6,updated_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING *", [u.tenantId, v.uuid(id), url, events, secret, b.active !== false]);
        return r.rows[0];
      }
      const r = await q.query("INSERT INTO webhook_endpoints(tenant_id,url,events,secret) VALUES($1,$2,$3,$4) RETURNING *", [u.tenantId, url, events, secret]);
      return r.rows[0];
    });
  }

  async list(u: any) {
    requirePermission(u, "user.manage");
    return this.db.tenant(u.tenantId, u.sub, async (q) =>
      (await q.query("SELECT id,url,events,active,last_triggered_at,created_at FROM webhook_endpoints WHERE tenant_id=$1 ORDER BY created_at DESC", [u.tenantId])).rows,
    );
  }

  async remove(u: any, id: string) {
    requirePermission(u, "user.manage");
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      await q.query("DELETE FROM webhook_endpoints WHERE tenant_id=$1 AND id=$2", [u.tenantId, v.uuid(id)]);
      return { ok: true };
    });
  }

  async deliveries(u: any, endpointId: string) {
    requirePermission(u, "user.manage");
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      const ep = (await q.query("SELECT id FROM webhook_endpoints WHERE tenant_id=$1 AND id=$2", [u.tenantId, v.uuid(endpointId)])).rows[0];
      if (!ep) throw new Error("Endpoint not found");
      return (await q.query("SELECT id,event,status_code,success,attempt,created_at FROM webhook_deliveries WHERE endpoint_id=$1 ORDER BY created_at DESC LIMIT 50", [endpointId])).rows;
    });
  }

  /** Dispatch an event to all matching tenant webhooks. Fire-and-forget. */
  async dispatch(tenantId: string, event: string, payload: object) {
    try {
      const endpoints = (await this.db.query(
        "SELECT id,url,secret FROM webhook_endpoints WHERE tenant_id=$1 AND active AND $2=ANY(events)",
        [tenantId, event],
      )).rows;

      for (const ep of endpoints) {
        this.deliverOne(ep, event, payload).catch(() => null);
      }
    } catch (err: any) {
      this.logger.error(`Webhook dispatch error: ${err.message}`);
    }
  }

  private async deliverOne(ep: { id: string; url: string; secret: string }, event: string, payload: object) {
    // Re-validate the stored URL at delivery time — covers the case where internal
    // DNS changes after registration (DNS rebinding attack vector).
    try {
      await validateWebhookUrl(ep.url);
    } catch (err: any) {
      this.logger.warn(`Webhook [${event}] blocked — SSRF protection: ${err.message}`);
      await this.db.query(
        "INSERT INTO webhook_deliveries(endpoint_id,event,payload,status_code,success) VALUES($1,$2,$3,$4,$5)",
        [ep.id, event, JSON.stringify(payload), 0, false],
      );
      return;
    }

    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
    const sig = crypto.createHmac("sha256", ep.secret).update(body).digest("hex");
    const start = Date.now();
    let statusCode = 0;
    let success = false;
    try {
      statusCode = await new Promise<number>((resolve, reject) => {
        const lib = ep.url.startsWith("https") ? https : http;
        const u = new URL(ep.url);
        const req = lib.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: "POST", headers: { "Content-Type": "application/json", "X-Lead2-Signature": `sha256=${sig}`, "X-Lead2-Event": event, "Content-Length": Buffer.byteLength(body), "User-Agent": "Lead2CRM-Webhook/1.0" }, timeout: 10000 }, (res) => resolve(res.statusCode || 0));
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
        req.write(body);
        req.end();
      });
      success = statusCode >= 200 && statusCode < 300;
    } catch {
      success = false;
    }
    await this.db.query(
      "INSERT INTO webhook_deliveries(endpoint_id,event,payload,status_code,success) VALUES($1,$2,$3,$4,$5)",
      [ep.id, event, JSON.stringify(payload), statusCode, success],
    );
    await this.db.query("UPDATE webhook_endpoints SET last_triggered_at=now() WHERE id=$1", [ep.id]);
    this.logger.log(`Webhook [${event}] → ${ep.url} → ${statusCode} (${Date.now() - start}ms)`);
  }
}
