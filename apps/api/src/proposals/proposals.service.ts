import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import * as mammoth from "mammoth";
import { validateDocxArchive } from "./docx-validation";
import { DbService } from "../db/db.service";
import {
  requirePermission,
  visibleUserIds,
  requireVisibleLead,
  hasPermission,
  tenantUserId,
} from "../common/permissions";
import * as v from "../common/validation";
import {
  calculate,
  escapeHtml,
  questions,
  sanitizeTemplate,
  validateTemplate,
  renderProposal,
} from "./proposal-utils";
import { MailService } from "../mail/mail.service";
import { WebhooksService } from "../webhooks/webhooks.service";
@Injectable()
export class ProposalsService {
  constructor(
    private db: DbService,
    private mail: MailService,
    private webhooks: WebhooksService,
  ) {}
  async catalogs(u: any) {
    requirePermission(u, "lead.read");
    return this.db.tenant(
      u.tenantId,
      u.sub,
      async (q) =>
        (
          await q.query(
            "SELECT * FROM commercial_catalogs WHERE tenant_id=$1 ORDER BY active DESC,name",
            [u.tenantId],
          )
        ).rows,
    );
  }
  async saveCatalog(u: any, b: any, id?: string) {
    requirePermission(u, "commercial.manage");
    if (!Array.isArray(b.items) || !b.items.length || b.items.length > 100)
      throw new BadRequestException(
        "A commercial needs 1–100 products or services",
      );
    const items = b.items.map((x: any) => ({
      id: x.id ? v.uuid(x.id, "Item ID") : randomUUID(),
      description: v.str(x.description, "Description", 1000),
      unit: v.str(x.unit || "unit", "Unit", 40),
      unitPrice: v.num(x.unitPrice, "Unit price", 0, 9999999999),
    }));
    if (new Set(items.map((x: any) => x.id)).size !== items.length)
      throw new BadRequestException("Item IDs must be unique");
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      const args = [
        u.tenantId,
        v.str(b.name, "Commercial name", 120),
        v.currency(b.currency),
        v.num(b.taxPct ?? 0, "Tax", 0, 100),
        JSON.stringify(items),
        v.str(b.terms || "", "Terms", 12000, false),
        b.active !== false,
      ];
      const r = id
        ? await q.query(
            "UPDATE commercial_catalogs SET name=$2,currency=$3,tax_pct=$4,items=$5,terms=$6,active=$7,version=version+1,updated_at=now() WHERE tenant_id=$1 AND id=$8 RETURNING *",
            [...args, v.uuid(id)],
          )
        : await q.query(
            "INSERT INTO commercial_catalogs(tenant_id,name,currency,tax_pct,items,terms,active) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
            args,
          );
      if (!r.rows[0]) throw new NotFoundException();
      await this.db.audit(
        q,
        u.tenantId,
        u.sub,
        "commercial.saved",
        "commercial",
        r.rows[0].id,
        { version: r.rows[0].version },
      );
      return r.rows[0];
    });
  }
  async templates(u: any) {
    requirePermission(u, "lead.read");
    return this.db.tenant(
      u.tenantId,
      u.sub,
      async (q) =>
        (
          await q.query(
            "SELECT * FROM proposal_templates WHERE tenant_id=$1 ORDER BY active DESC,name",
            [u.tenantId],
          )
        ).rows,
    );
  }
  async saveTemplate(u: any, b: any, id?: string) {
    requirePermission(u, "template.manage");
    let html = b.bodyHtml,
      filename: string | null = null;
    if (b.fileBase64) {
      filename = v.str(b.filename, "Filename", 160);
      if (
        typeof b.fileBase64 !== "string" ||
        b.fileBase64.length > 2800000 ||
        !/^[a-zA-Z0-9+/=\r\n]+$/.test(b.fileBase64)
      )
        throw new BadRequestException("Upload a file smaller than 2 MB");
      const buf = Buffer.from(b.fileBase64, "base64");
      if (buf.length > 2 * 1024 * 1024)
        throw new BadRequestException("File is too large");
      if (/\.docx$/i.test(filename)) {
        try {
          validateDocxArchive(buf);
          const out = await mammoth.convertToHtml({ buffer: buf }, {
            externalFileAccess: false,
          } as any);
          html = out.value;
        } catch {
          throw new BadRequestException(
            "Use a valid DOCX under 2 MB (10 MB expanded). Password-protected files are unsupported.",
          );
        }
      } else if (/\.(html?|txt|md)$/i.test(filename)) {
        const text = buf.toString("utf8");
        html = /\.html?$/i.test(filename)
          ? text
          : text
              .split(/\n\s*\n/)
              .map((p) => "<p>" + escapeHtml(p).replace(/\n/g, "<br>") + "</p>")
              .join("");
      } else
        throw new BadRequestException("Upload DOCX, HTML, TXT, or Markdown");
    }
    const qs = questions(b.questions || []),
      body = validateTemplate(
        sanitizeTemplate(v.str(html, "Template content", 150000)),
        qs,
      );
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      const args = [
        u.tenantId,
        v.str(b.name, "Template name", 120),
        body,
        JSON.stringify(qs),
        filename,
        b.active !== false,
      ];
      const r = id
        ? await q.query(
            "UPDATE proposal_templates SET name=$2,body_html=$3,questions=$4,source_filename=coalesce($5,source_filename),active=$6,version=version+1,updated_at=now() WHERE tenant_id=$1 AND id=$7 RETURNING *",
            [...args, v.uuid(id)],
          )
        : await q.query(
            "INSERT INTO proposal_templates(tenant_id,name,body_html,questions,source_filename,active) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
            args,
          );
      if (!r.rows[0]) throw new NotFoundException();
      await this.db.audit(
        q,
        u.tenantId,
        u.sub,
        "template.saved",
        "template",
        r.rows[0].id,
        { version: r.rows[0].version },
      );
      return r.rows[0];
    });
  }
  private allowed(u: any, p: any) {
    return (
      hasPermission(u, "proposal.approve") &&
      (u.platformAdmin || p.created_by !== u.sub) &&
      Number(p.discount_pct) <= u.authority.approveDiscountPct &&
      Number(p.total) <= u.authority.approveTotal
    );
  }
  async list(u: any) {
    requirePermission(u, "lead.read");
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      const ids = await visibleUserIds(q, u);
      return (
        await q.query(
          "SELECT p.id,p.title,p.currency,p.total,p.discount_pct,p.status,p.created_by,p.approval_required,p.created_at,p.lead_id,p.valid_until,l.name lead_name,u.name creator_name FROM proposals p JOIN leads l ON l.id=p.lead_id LEFT JOIN users u ON u.id=p.created_by WHERE p.tenant_id=$1 AND ($2::uuid[] IS NULL OR l.owner_id=ANY($2)) ORDER BY p.created_at DESC LIMIT 500",
          [u.tenantId, ids],
        )
      ).rows.map((p) => ({ ...p, canApprove: this.allowed(u, p) }));
    });
  }
  async one(u: any, id: string) {
    requirePermission(u, "lead.read");
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      const p = (
        await q.query(
          "SELECT p.*,l.name lead_name FROM proposals p JOIN leads l ON l.id=p.lead_id WHERE p.tenant_id=$1 AND p.id=$2",
          [u.tenantId, v.uuid(id)],
        )
      ).rows[0];
      if (!p) throw new NotFoundException();
      await requireVisibleLead(q, u, p.lead_id);
      return p;
    });
  }
  async create(u: any, b: any) {
    requirePermission(u, "proposal.write");
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      const lead = await requireVisibleLead(q, u, v.uuid(b.leadId, "Lead"));
      const c = (
          await q.query(
            "SELECT * FROM commercial_catalogs WHERE tenant_id=$1 AND id=$2 AND active FOR SHARE",
            [u.tenantId, v.uuid(b.commercialId, "Commercial")],
          )
        ).rows[0],
        template = (
          await q.query(
            "SELECT * FROM proposal_templates WHERE tenant_id=$1 AND id=$2 AND active FOR SHARE",
            [u.tenantId, v.uuid(b.templateId, "Template")],
          )
        ).rows[0];
      if (!c || !template)
        throw new BadRequestException(
          "Select an active commercial and template",
        );
      const answers: any = {};
      for (const question of template.questions) {
        answers[question.key] = v.str(
          b.answers?.[question.key] || "",
          question.label,
          4000,
          question.required,
        );
      }
      const total = calculate(c, b.items, b.discountPct),
        requires = total.discountPct > u.authority.selfDiscountPct;
      const validity = v.date(b.validUntil, "Valid until", false)!;
      if (validity.slice(0, 10) < new Date().toISOString().slice(0, 10))
        throw new BadRequestException("Choose a future proposal validity date");
      const snapshot = {
        template: {
          id: template.id,
          name: template.name,
          version: template.version,
          body_html: template.body_html,
        },
        commercial: { id: c.id, name: c.name, version: c.version },
        answers,
        lead: { name: lead.name, company: lead.company },
        sellerName: u.tenantName,
        calculation: total,
      };
      const p = (
        await q.query(
          `INSERT INTO proposals(tenant_id,lead_id,created_by,owner_id,title,currency,items,subtotal,discount_pct,tax_pct,total,terms,status,approval_required,template_id,commercial_id,snapshot,valid_until) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
          [
            u.tenantId,
            lead.id,
            tenantUserId(u),
            lead.owner_id,
            v.str(b.title || "Commercial proposal", "Title", 180),
            c.currency,
            JSON.stringify(total.items),
            total.subtotal,
            total.discountPct,
            total.taxPct,
            total.total,
            c.terms,
            requires ? "approval_required" : "draft",
            requires,
            template.id,
            c.id,
            JSON.stringify(snapshot),
            validity,
          ],
        )
      ).rows[0];
      await this.db.audit(
        q,
        u.tenantId,
        u.sub,
        "proposal.generated",
        "proposal",
        p.id,
        {
          commercialVersion: c.version,
          templateVersion: template.version,
          approvalRequired: requires,
        },
        u.ip,
      );
      return p;
    });
  }
  async status(u: any, id: string, b: any) {
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      const p = (
        await q.query(
          "SELECT * FROM proposals WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
          [u.tenantId, v.uuid(id)],
        )
      ).rows[0];
      if (!p) throw new NotFoundException();
      await requireVisibleLead(q, u, p.lead_id);
      const next = b.status;
      if (["approved", "rejected"].includes(next)) {
        requirePermission(u, "proposal.approve");
        if (p.status !== "approval_required")
          throw new ConflictException("Only pending proposals can be reviewed");
        if (!u.platformAdmin && p.created_by === u.sub)
          throw new ForbiddenException(
            "A different authorized person must review your proposal",
          );
        if (next === "approved" && !this.allowed(u, p))
          throw new ForbiddenException(
            "This proposal exceeds your approval authority",
          );
      } else {
        requirePermission(u, "proposal.write");
        if (next === "sent") {
          if (!(
            (p.status === "draft" && !p.approval_required) ||
            p.status === "approved"
          ))
            throw new ConflictException(
              "This proposal must be approved before sending",
            );
          if (
            p.valid_until &&
            new Date(p.valid_until).toISOString().slice(0, 10) <
              new Date().toISOString().slice(0, 10)
          )
            throw new ConflictException(
              "This proposal has expired. Generate a new one.",
            );
        } else if (["accepted", "declined"].includes(next)) {
          if (p.status !== "sent")
            throw new ConflictException(
              "Only sent proposals can be marked accepted or declined",
            );
        } else throw new BadRequestException("Invalid proposal transition");
      }
      const r = await q.query(
        `UPDATE proposals SET status=$3,approved_by=CASE WHEN $3='approved' THEN $4 ELSE approved_by END,approved_at=CASE WHEN $3='approved' THEN now() ELSE approved_at END,approval_note=CASE WHEN $3 IN ('approved','rejected') THEN $5 ELSE approval_note END,updated_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING *`,
        [
          u.tenantId,
          id,
          next,
          tenantUserId(u),
          v.str(b.note || "", "Review note", 2000, false),
        ],
      );
      // Email notifications on approval decision
      if (next === "approved" || next === "rejected") {
        const owner = (
          await q.query(
            "SELECT u.name,u.email FROM users u JOIN proposals p ON p.owner_id=u.id WHERE p.id=$1",
            [id],
          )
        ).rows[0];
        if (owner?.email) {
          this.mail
            .sendProposalDecision(owner.email, owner.name, p.title, next === "approved", b.note)
            .catch(() => null);
        }
      } else if (next === "approval_required") {
        // Notify managers who can approve
        const approvers = (
          await q.query(
            "SELECT u.name,u.email FROM users u JOIN roles r ON r.id=u.role_id WHERE u.tenant_id=$1 AND u.active AND r.permissions::text LIKE '%proposal.approve%'",
            [u.tenantId],
          )
        ).rows;
        for (const approver of approvers) {
          if (approver.email)
            this.mail
              .sendProposalApprovalRequest(approver.email, approver.name, u.name, p.title, id)
              .catch(() => null);
        }
      }
      // Webhook dispatch
      this.webhooks
        .dispatch(u.tenantId, `proposal.${next}`, { proposalId: id, title: p.title, status: next })
        .catch(() => null);
      await this.db.audit(
        q,
        u.tenantId,
        u.sub,
        "proposal." + next,
        "proposal",
        id,
        { note: b.note || "" },
        u.ip,
      );
      return r.rows[0];
    });
  }
  async document(u: any, id: string) {
    const p = await this.one(u, id);
    await this.db.tenant(u.tenantId, u.sub, (q) =>
      this.db.audit(q, u.tenantId, u.sub, "proposal.exported", "proposal", id, {}, u.ip),
    );
    return renderProposal(p, u.tenantName);
  }
}
