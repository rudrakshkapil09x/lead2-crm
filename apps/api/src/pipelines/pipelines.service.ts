import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DbService } from "../db/db.service";
import { requirePermission } from "../common/permissions";
import * as v from "../common/validation";
@Injectable()
export class PipelinesService {
  constructor(private db: DbService) {}
  async list(u: any) {
    requirePermission(u, "lead.read");
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      const p = (
          await q.query(
            "SELECT * FROM pipelines WHERE tenant_id=$1 ORDER BY is_default DESC,created_at",
            [u.tenantId],
          )
        ).rows,
        s = (
          await q.query(
            "SELECT * FROM pipeline_stages WHERE tenant_id=$1 ORDER BY position",
            [u.tenantId],
          )
        ).rows;
      return p.map((x) => ({
        ...x,
        stages: s.filter((y) => y.pipeline_id === x.id),
      }));
    });
  }
  async create(u: any, b: any) {
    requirePermission(u, "pipeline.manage");
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      await q.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [
        u.tenantId,
      ]);
      if (b.isDefault)
        await q.query(
          "UPDATE pipelines SET is_default=false WHERE tenant_id=$1",
          [u.tenantId],
        );
      const r = await q.query(
        "INSERT INTO pipelines(tenant_id,name,is_default) VALUES($1,$2,$3) RETURNING *",
        [u.tenantId, v.str(b.name, "Pipeline name", 80), !!b.isDefault],
      );
      await this.db.audit(
        q,
        u.tenantId,
        u.sub,
        "pipeline.created",
        "pipeline",
        r.rows[0].id,
      );
      return r.rows[0];
    });
  }
  private stage(b: any, old: any = {}) {
    const out = {
      name: v.str(b.name ?? old.name, "Stage name", 80),
      color: b.color ?? old.color ?? "#6b7f93",
      probability: v.integer(
        b.probability ?? old.probability ?? 0,
        "Probability",
        0,
        100,
      ),
      outcome: b.outcome ?? old.outcome ?? "open",
      requiredFields: b.requiredFields ?? old.required_fields ?? [],
    };
    if (
      !/^#[0-9a-f]{6}$/i.test(out.color) ||
      !["open", "won", "lost"].includes(out.outcome) ||
      !Array.isArray(out.requiredFields) ||
      out.requiredFields.some(
        (x: any) =>
          !["phone", "email", "company", "value", "source"].includes(x),
      )
    )
      throw new BadRequestException(
        "Invalid stage color, outcome or required fields",
      );
    if (out.outcome === "won") out.probability = 100;
    if (out.outcome === "lost") out.probability = 0;
    return out;
  }
  async addStage(u: any, id: string, b: any) {
    requirePermission(u, "pipeline.manage");
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      const pipe = (
        await q.query(
          "SELECT id FROM pipelines WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
          [u.tenantId, v.uuid(id)],
        )
      ).rows[0];
      if (!pipe) throw new NotFoundException();
      const s = this.stage(b),
        pos = (
          await q.query(
            "SELECT coalesce(max(position),0)+1 n FROM pipeline_stages WHERE tenant_id=$1 AND pipeline_id=$2",
            [u.tenantId, id],
          )
        ).rows[0].n;
      const r = await q.query(
        "INSERT INTO pipeline_stages(tenant_id,pipeline_id,name,color,probability,outcome,required_fields,position) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
        [
          u.tenantId,
          id,
          s.name,
          s.color,
          s.probability,
          s.outcome,
          JSON.stringify(s.requiredFields),
          pos,
        ],
      );
      await this.db.audit(
        q,
        u.tenantId,
        u.sub,
        "stage.created",
        "stage",
        r.rows[0].id,
      );
      return r.rows[0];
    });
  }
  async editStage(u: any, id: string, b: any) {
    requirePermission(u, "pipeline.manage");
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      const old = (
        await q.query(
          "SELECT * FROM pipeline_stages WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
          [u.tenantId, v.uuid(id)],
        )
      ).rows[0];
      if (!old) throw new NotFoundException();
      const s = this.stage(b, old);
      if (
        old.outcome !== s.outcome &&
        (
          await q.query(
            "SELECT id FROM leads WHERE tenant_id=$1 AND stage_id=$2 LIMIT 1",
            [u.tenantId, id],
          )
        ).rows.length
      )
        throw new BadRequestException(
          "A stage with leads must keep its current outcome",
        );
      const r = await q.query(
        "UPDATE pipeline_stages SET name=$3,color=$4,probability=$5,outcome=$6,required_fields=$7 WHERE tenant_id=$1 AND id=$2 RETURNING *",
        [
          u.tenantId,
          id,
          s.name,
          s.color,
          s.probability,
          s.outcome,
          JSON.stringify(s.requiredFields),
        ],
      );
      await this.db.audit(q, u.tenantId, u.sub, "stage.updated", "stage", id);
      return r.rows[0];
    });
  }
}
