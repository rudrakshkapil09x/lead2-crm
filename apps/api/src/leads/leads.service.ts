import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DbService, TenantClient } from "../db/db.service";
import { CryptoService } from "../common/crypto.service";
import {
  requirePermission,
  hasPermission,
  visibleUserIds,
  requireVisibleLead,
  requireAssignee,
  defaultOwner,
  tenantUserId,
} from "../common/permissions";
import { RequestUser } from "../common/request-user";
import * as v from "../common/validation";
@Injectable()
export class LeadsService {
  constructor(
    private db: DbService,
    private crypto: CryptoService,
  ) {}
  private row(r: any) {
    const { phone_enc, email_enc, phone_hash, email_hash, ...rest } = r;
    return {
      ...rest,
      phone: this.crypto.decrypt(phone_enc),
      email: this.crypto.decrypt(email_enc),
    };
  }
  private age() {
    return "floor(extract(epoch from (now()-l.created_at))/86400)::int lead_age_days,floor(extract(epoch from (now()-l.stage_entered_at))/86400)::int stage_age_days";
  }
  async list(u: RequestUser, b: any) {
    requirePermission(u, "lead.read");
    return this.db.tenant(u.tenantId!, u.sub, async (q) => {
      const ids = await visibleUserIds(q, u),
        args: any[] = [u.tenantId, ids],
        where = [
          "l.tenant_id=$1",
          "($2::uuid[] IS NULL OR l.owner_id=ANY($2))",
        ];
      for (const [input, col] of [
        ["stageId", "stage_id"],
        ["pipelineId", "pipeline_id"],
        ["ownerId", "owner_id"],
      ] as const)
        if (b[input]) {
          args.push(v.uuid(b[input]));
          where.push(`l.${col}=$${args.length}`);
        }
      if (b.q) {
        args.push("%" + v.str(b.q, "Search", 120) + "%");
        where.push(
          `(l.name ILIKE $${args.length} OR coalesce(l.company,'') ILIKE $${args.length} OR coalesce(l.source,'') ILIKE $${args.length})`,
        );
      }
      args.push(
        v.integer(b.limit ?? 500, "Limit", 1, 500),
        v.integer(b.offset ?? 0, "Offset", 0, 10000000),
      );
      const rows = (
        await q.query(
          `SELECT l.*,${this.age()},s.name stage_name,s.color stage_color,s.probability,u.name owner_name,p.name pipeline_name,
           array_agg(DISTINCT lt.name) FILTER(WHERE lt.id IS NOT NULL) tag_names
           FROM leads l
           JOIN pipeline_stages s ON s.id=l.stage_id
           JOIN pipelines p ON p.id=l.pipeline_id
           LEFT JOIN users u ON u.id=l.owner_id
           LEFT JOIN lead_tag_assignments lta ON lta.lead_id=l.id
           LEFT JOIN lead_tags lt ON lt.id=lta.tag_id
           WHERE ${where.join(" AND ")}
           GROUP BY l.id,s.name,s.color,s.probability,u.name,p.name
           ORDER BY l.updated_at DESC,l.id
           LIMIT $${args.length - 1} OFFSET $${args.length}`,
          args,
        )
      ).rows;
      return rows.map((x) => this.row(x));
    });
  }
  async one(u: RequestUser, id: string) {
    requirePermission(u, "lead.read");
    return this.db.tenant(u.tenantId!, u.sub, async (q) => {
      await requireVisibleLead(q, u, v.uuid(id));
      const l = (
        await q.query(
          `SELECT l.*,${this.age()},s.name stage_name,s.color stage_color,u.name owner_name FROM leads l JOIN pipeline_stages s ON s.id=l.stage_id LEFT JOIN users u ON u.id=l.owner_id WHERE l.id=$1`,
          [id],
        )
      ).rows[0];
      const tags = (
        await q.query(
          "SELECT t.id,t.name,t.color FROM lead_tags t JOIN lead_tag_assignments a ON a.tag_id=t.id WHERE a.lead_id=$1",
          [id],
        )
      ).rows;
      const acts = (
        await q.query(
          "SELECT a.*,u.name user_name FROM activities a LEFT JOIN users u ON u.id=a.user_id WHERE a.tenant_id=$1 AND a.lead_id=$2 ORDER BY occurred_at DESC LIMIT 300",
          [u.tenantId, id],
        )
      ).rows;
      const history = (
        await q.query(
          "SELECT h.*,s.name stage_name,s.color,round(extract(epoch from (coalesce(h.exited_at,now())-h.entered_at))/86400.0,1) age_days FROM lead_stage_history h JOIN pipeline_stages s ON s.id=h.stage_id WHERE h.tenant_id=$1 AND h.lead_id=$2 ORDER BY h.entered_at DESC",
          [u.tenantId, id],
        )
      ).rows;
      await this.db.audit(q, u.tenantId!, u.sub, "lead.view", "lead", id, {}, u.ip);
      return { 
        ...this.row(l), 
        tags, 
        tagIds: tags.map((t) => t.id), 
        activities: acts, 
        stageHistory: history 
      };
    });
  }
  private async duplicate(
    q: TenantClient,
    u: RequestUser,
    ph: string | null,
    eh: string | null,
    except?: string,
  ) {
    const r = await q.query(
      "SELECT id FROM leads WHERE tenant_id=$1 AND (($2::text IS NOT NULL AND phone_hash=$2) OR ($3::text IS NOT NULL AND email_hash=$3)) AND ($4::uuid IS NULL OR id<>$4) LIMIT 1",
      [u.tenantId, ph, eh, except || null],
    );
    return r.rows.length > 0;
  }
  private fields(b: any, old: any = {}) {
    return {
      name: b.name === undefined ? old.name : v.str(b.name, "Lead name", 180),
      company:
        b.company === undefined
          ? old.company
          : v.str(b.company, "Company", 180, false),
      source:
        b.source === undefined
          ? old.source
          : v.str(b.source, "Source", 80, false),
      value:
        b.value === undefined
          ? old.value || 0
          : v.num(b.value, "Deal value", 0, 999999999999),
      phone:
        b.phone === undefined
          ? this.crypto.decrypt(old.phone_enc)
          : v.str(b.phone, "Phone", 40, false),
      email:
        b.email === undefined
          ? this.crypto.decrypt(old.email_enc)
          : b.email
            ? v.email(b.email)
            : null,
      custom_fields:
        b.customFields === undefined ? old.custom_fields || {} : b.customFields,
    };
  }
  private required(stage: any, data: any) {
    for (const f of stage.required_fields || []) {
      const x = data[f] ?? data.custom_fields?.[f];
      if (
        x === null ||
        x === undefined ||
        x === "" ||
        (f === "value" && Number(x) <= 0)
      )
        throw new BadRequestException(
          `Complete ${f} before entering ${stage.name}`,
        );
    }
  }
  async create(u: RequestUser, b: any) {
    requirePermission(u, "lead.write");
    return this.db.tenant(u.tenantId!, u.sub, async (q) => {
      await q.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [
        u.tenantId,
      ]);
      const f = this.fields(b);
      f.name = v.str(f.name, "Lead name", 180);
      const pipe =
        b.pipelineId ||
        (
          await q.query(
            "SELECT id FROM pipelines WHERE tenant_id=$1 ORDER BY is_default DESC,created_at LIMIT 1",
            [u.tenantId],
          )
        ).rows[0]?.id;
      if (!pipe) throw new BadRequestException("Create a pipeline first");
      const stage = (
        await q.query(
          "SELECT * FROM pipeline_stages WHERE tenant_id=$1 AND pipeline_id=$2 AND ($3::uuid IS NULL OR id=$3) ORDER BY position LIMIT 1",
          [u.tenantId, v.uuid(pipe), b.stageId ? v.uuid(b.stageId) : null],
        )
      ).rows[0];
      if (!stage)
        throw new BadRequestException("Choose a valid pipeline stage");
      this.required(stage, f);
      const owner = b.ownerId || (await defaultOwner(q, u));
      if (b.ownerId && owner !== u.sub) requirePermission(u, "lead.assign");
      await requireAssignee(q, u, owner);
      const ph = this.crypto.contactHash(f.phone),
        eh = this.crypto.contactHash(f.email);
      if (await this.duplicate(q, u, ph, eh))
        return {
          duplicate: true,
          matches: [],
          message:
            "This contact already exists in this workspace. Ask your manager to find or reassign it.",
        };
      const l = (
        await q.query(
          `INSERT INTO leads(tenant_id,pipeline_id,stage_id,owner_id,name,company,phone_enc,phone_hash,email_enc,email_hash,value,source,custom_fields,status,closed_at,last_activity_at,score) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,CASE WHEN $14='open' THEN NULL ELSE now() END,now(),$15) RETURNING *`,
          [
            u.tenantId,
            pipe,
            stage.id,
            owner,
            f.name,
            f.company,
            this.crypto.encrypt(f.phone),
            ph,
            this.crypto.encrypt(f.email),
            eh,
            f.value,
            f.source,
            JSON.stringify(f.custom_fields),
            stage.outcome,
            b.score !== undefined ? v.integer(b.score, "Score", 0, 100) : 0,
          ],
        )
      ).rows[0];
      await q.query(
        "INSERT INTO lead_stage_history(tenant_id,lead_id,pipeline_id,stage_id,changed_by) VALUES($1,$2,$3,$4,$5)",
        [u.tenantId, l.id, pipe, stage.id, tenantUserId(u)],
      );
      await q.query(
        "INSERT INTO activities(tenant_id,lead_id,user_id,type,body) VALUES($1,$2,$3,'created','Lead created')",
        [u.tenantId, l.id, tenantUserId(u)],
      );
      await this.db.audit(q, u.tenantId!, u.sub, "lead.created", "lead", l.id, {}, u.ip);
      return this.row(l);
    });
  }
  private async transferRelated(
    q: TenantClient,
    u: RequestUser,
    id: string,
    oldOwner: string,
    newOwner: string,
  ) {
    await q.query(
      "UPDATE tasks SET assignee_id=$4 WHERE tenant_id=$1 AND lead_id=$2 AND assignee_id=$3 AND status='open'",
      [u.tenantId, id, oldOwner, newOwner],
    );
    await q.query(
      "UPDATE proposals SET owner_id=$3 WHERE tenant_id=$1 AND lead_id=$2",
      [u.tenantId, id, newOwner],
    );
  }
  async update(u: RequestUser, id: string, b: any) {
    requirePermission(u, "lead.write");
    return this.db.tenant(u.tenantId!, u.sub, async (q) => {
      await q.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [
        u.tenantId,
      ]);
      const old = await requireVisibleLead(q, u, v.uuid(id), true),
        f = this.fields(b, old),
        changed = !!b.stageId && b.stageId !== old.stage_id;
      const stage = (
        await q.query(
          "SELECT * FROM pipeline_stages WHERE tenant_id=$1 AND id=$2 AND pipeline_id=$3",
          [
            u.tenantId,
            b.stageId ? v.uuid(b.stageId) : old.stage_id,
            old.pipeline_id,
          ],
        )
      ).rows[0];
      if (!stage)
        throw new BadRequestException(
          "Stage must belong to the lead’s pipeline",
        );
      this.required(stage, f);
      if (b.status && b.status !== stage.outcome)
        throw new BadRequestException(
          "Move the lead to the corresponding won or lost stage to change its outcome",
        );
      const owner = b.ownerId || old.owner_id;
      if (owner !== old.owner_id) {
        requirePermission(u, "lead.assign");
        await requireAssignee(q, u, v.uuid(owner));
      }
      const ph = this.crypto.contactHash(f.phone),
        eh = this.crypto.contactHash(f.email);
      if (
        (ph !== old.phone_hash || eh !== old.email_hash) &&
        (await this.duplicate(q, u, ph, eh, id))
      )
        throw new ConflictException(
          "This contact already exists in the workspace",
        );
      const l = (
        await q.query(
          `UPDATE leads SET name=$3,company=$4,source=$5,value=$6,phone_enc=$7,phone_hash=$8,email_enc=$9,email_hash=$10,custom_fields=$11,stage_id=$12,owner_id=$13,status=$14,stage_entered_at=CASE WHEN $15 THEN now() ELSE stage_entered_at END,closed_at=CASE WHEN $14='open' THEN NULL WHEN status<>$14 OR closed_at IS NULL THEN now() ELSE closed_at END,lost_reason=$16,updated_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING *`,
          [
            u.tenantId,
            id,
            f.name,
            f.company,
            f.source,
            f.value,
            this.crypto.encrypt(f.phone),
            ph,
            this.crypto.encrypt(f.email),
            eh,
            JSON.stringify(f.custom_fields),
            stage.id,
            owner,
            stage.outcome,
            changed,
            b.lostReason === undefined
              ? old.lost_reason
              : v.str(b.lostReason, "Lost reason", 1000, false),
          ],
        )
      ).rows[0];
      if (changed) {
        await q.query(
          "UPDATE lead_stage_history SET exited_at=now() WHERE tenant_id=$1 AND lead_id=$2 AND exited_at IS NULL",
          [u.tenantId, id],
        );
        await q.query(
          "INSERT INTO lead_stage_history(tenant_id,lead_id,pipeline_id,stage_id,changed_by) VALUES($1,$2,$3,$4,$5)",
          [u.tenantId, id, old.pipeline_id, stage.id, tenantUserId(u)],
        );
        await q.query(
          "INSERT INTO activities(tenant_id,lead_id,user_id,type,body) VALUES($1,$2,$3,'stage_change',$4)",
          [u.tenantId, id, tenantUserId(u), "Moved to " + stage.name],
        );
      }
      if (owner !== old.owner_id)
        await this.transferRelated(q, u, id, old.owner_id, owner);
      await this.db.audit(q, u.tenantId!, u.sub, "lead.updated", "lead", id, {
        fields: Object.keys(b),
      }, u.ip);
      return this.row(l);
    });
  }
  async assign(u: RequestUser, b: any) {
    requirePermission(u, "lead.assign");
    if (
      !Array.isArray(b.leadIds) ||
      !b.leadIds.length ||
      b.leadIds.length > 500
    )
      throw new BadRequestException("Select 1–500 leads");
    return this.db.tenant(u.tenantId!, u.sub, async (q) => {
      await q.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [
        u.tenantId,
      ]);
      const target = await requireAssignee(q, u, v.uuid(b.ownerId));
      for (const id of [...new Set<string>(b.leadIds)]) {
        const old = await requireVisibleLead(q, u, v.uuid(id), true);
        await q.query(
          "UPDATE leads SET owner_id=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2",
          [u.tenantId, id, target],
        );
        await this.transferRelated(q, u, id, old.owner_id, target);
        await this.db.audit(
          q,
          u.tenantId!,
          u.sub,
          "lead.assigned",
          "lead",
          id,
          { from: old.owner_id, to: target },
          u.ip,
        );
      }
      return { ok: true };
    });
  }
  async addActivity(u: RequestUser, id: string, b: any) {
    requirePermission(u, "lead.write");
    return this.db.tenant(u.tenantId!, u.sub, async (q) => {
      await requireVisibleLead(q, u, v.uuid(id));
      if (!["note", "call", "email", "meeting"].includes(b.type || "note"))
        throw new BadRequestException("Invalid activity type");
      const r = await q.query(
        "INSERT INTO activities(tenant_id,lead_id,user_id,type,body) VALUES($1,$2,$3,$4,$5) RETURNING *",
        [
          u.tenantId,
          id,
          tenantUserId(u),
          b.type || "note",
          v.str(b.body, "Activity", 5000),
        ],
      );
      await q.query(
        "UPDATE leads SET last_activity_at=now(),updated_at=now() WHERE tenant_id=$1 AND id=$2",
        [u.tenantId, id],
      );
      await this.db.audit(
        q,
        u.tenantId!,
        u.sub,
        "activity.created",
        "lead",
        id,
        {},
        u.ip,
      );
      return r.rows[0];
    });
  }
  async remove(u: RequestUser, id: string) {
    requirePermission(u, "lead.delete");
    return this.db.tenant(u.tenantId!, u.sub, async (q) => {
      await requireVisibleLead(q, u, v.uuid(id), true);
      if (
        (
          await q.query(
            "SELECT id FROM proposals WHERE tenant_id=$1 AND lead_id=$2 LIMIT 1",
            [u.tenantId, id],
          )
        ).rows.length
      )
        throw new ConflictException(
          "Leads with proposals are retained for history. Mark this lead lost instead.",
        );
      await q.query("DELETE FROM leads WHERE tenant_id=$1 AND id=$2", [
        u.tenantId,
        id,
      ]);
      await this.db.audit(q, u.tenantId!, u.sub, "lead.deleted", "lead", id, {}, u.ip);
      return { ok: true };
    });
  }
  async importRows(u: RequestUser, rows: any[]) {
    requirePermission(u, "lead.write");
    if (!Array.isArray(rows) || rows.length > 1000)
      throw new BadRequestException("Import up to 1,000 rows per batch");
    // BUG-06 FIX: single tenant transaction for the whole batch — lock tenant row once
    return this.db.tenant(u.tenantId!, u.sub, async (q) => {
      await q.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [u.tenantId]);
      const summary = { created: 0, duplicates: 0, errors: [] as any[] };
      for (const [i, row] of rows.entries()) {
        try {
          // Call private create logic directly on the already-open tenant client
          const f = this.fields(row);
          f.name = v.str(f.name, "Lead name", 180);
          const pipe =
            row.pipelineId ||
            (
              await q.query(
                "SELECT id FROM pipelines WHERE tenant_id=$1 ORDER BY is_default DESC,created_at LIMIT 1",
                [u.tenantId],
              )
            ).rows[0]?.id;
          if (!pipe) { summary.errors.push({ row: i + 2, error: "No pipeline found" }); continue; }
          const stage = (
            await q.query(
              "SELECT * FROM pipeline_stages WHERE tenant_id=$1 AND pipeline_id=$2 ORDER BY position LIMIT 1",
              [u.tenantId, pipe],
            )
          ).rows[0];
          if (!stage) { summary.errors.push({ row: i + 2, error: "No stage found" }); continue; }
          const ph = this.crypto.contactHash(f.phone),
            eh = this.crypto.contactHash(f.email);
          if (await this.duplicate(q, u, ph, eh)) { summary.duplicates++; continue; }
          const l = (
            await q.query(
              "INSERT INTO leads(tenant_id,pipeline_id,stage_id,owner_id,name,company,phone_enc,phone_hash,email_enc,email_hash,value,source,custom_fields,status,closed_at,last_activity_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,CASE WHEN $14='open' THEN NULL ELSE now() END,now()) RETURNING *",
              [u.tenantId, pipe, stage.id, u.sub, f.name, f.company, this.crypto.encrypt(f.phone), ph, this.crypto.encrypt(f.email), eh, f.value, f.source, JSON.stringify(f.custom_fields || {}), stage.outcome],
            )
          ).rows[0];
          await q.query(
            "INSERT INTO lead_stage_history(tenant_id,lead_id,pipeline_id,stage_id,changed_by) VALUES($1,$2,$3,$4,$5)",
            [u.tenantId, l.id, pipe, stage.id, u.sub],
          );
          summary.created++;
        } catch (e: any) {
          summary.errors.push({ row: i + 2, error: e.message });
        }
      }
      return summary;
    });
  }

  // ─── Tags ───────────────────────────────────────────────────────────────────
  async listTags(u: RequestUser) {
    requirePermission(u, "lead.read");
    return this.db.tenant(u.tenantId!, u.sub, async (q) =>
      (await q.query("SELECT * FROM lead_tags WHERE tenant_id=$1 ORDER BY name", [u.tenantId])).rows,
    );
  }

  async upsertTag(u: RequestUser, b: any, id?: string) {
    requirePermission(u, "lead.write");
    return this.db.tenant(u.tenantId!, u.sub, async (q) => {
      if (id) {
        const r = await q.query(
          "UPDATE lead_tags SET name=$3,color=$4 WHERE tenant_id=$1 AND id=$2 RETURNING *",
          [u.tenantId, v.uuid(id), v.str(b.name, "Tag name", 60), v.str(b.color ?? "#64748b", "Color", 20)],
        );
        return r.rows[0];
      }
      const r = await q.query(
        "INSERT INTO lead_tags(tenant_id,name,color) VALUES($1,$2,$3) ON CONFLICT(tenant_id,name) DO UPDATE SET color=$3 RETURNING *",
        [u.tenantId, v.str(b.name, "Tag name", 60), v.str(b.color ?? "#64748b", "Color", 20)],
      );
      return r.rows[0];
    });
  }

  async setLeadTags(u: RequestUser, leadId: string, tagIds: string[]) {
    requirePermission(u, "lead.write");
    return this.db.tenant(u.tenantId!, u.sub, async (q) => {
      await requireVisibleLead(q, u, v.uuid(leadId));
      await q.query("DELETE FROM lead_tag_assignments WHERE lead_id=$1", [leadId]);
      for (const tid of tagIds) {
        await q.query(
          "INSERT INTO lead_tag_assignments(lead_id,tag_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
          [leadId, v.uuid(tid)],
        );
      }
      return { ok: true };
    });
  }
}
