import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DbService } from "../db/db.service";
import { MailService } from "../mail/mail.service";
import {
  requirePermission,
  visibleUserIds,
  requireAssignee,
  requireVisibleLead,
  defaultOwner,
  tenantUserId,
} from "../common/permissions";
import * as v from "../common/validation";

const VALID_RECURRENCE = ["daily", "weekly", "monthly"] as const;
type Recurrence = (typeof VALID_RECURRENCE)[number];

function nextDueDate(from: Date, rule: Recurrence): Date {
  const d = new Date(from);
  switch (rule) {
    case "daily": d.setDate(d.getDate() + 1); break;
    case "weekly": d.setDate(d.getDate() + 7); break;
    case "monthly": d.setMonth(d.getMonth() + 1); break;
  }
  return d;
}

@Injectable()
export class TasksService {
  constructor(
    private db: DbService,
    private mail: MailService,
  ) {}

  async list(u: any, b: any) {
    requirePermission(u, "lead.read");
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      const ids = await visibleUserIds(q, u);
      return (
        await q.query(
          "SELECT t.*,l.name lead_name,u.name assignee_name FROM tasks t LEFT JOIN leads l ON l.id=t.lead_id LEFT JOIN users u ON u.id=t.assignee_id WHERE t.tenant_id=$1 AND ($2::uuid[] IS NULL OR t.assignee_id=ANY($2)) AND (t.lead_id IS NULL OR $2::uuid[] IS NULL OR l.owner_id=ANY($2)) AND ($3::text IS NULL OR t.status=$3) ORDER BY t.status,t.due_at NULLS LAST LIMIT 500",
          [u.tenantId, ids, b.status || null],
        )
      ).rows;
    });
  }

  async create(u: any, b: any) {
    requirePermission(u, "task.write");
    const recurrence = b.recurrence
      ? VALID_RECURRENCE.includes(b.recurrence)
        ? (b.recurrence as Recurrence)
        : (() => { throw new BadRequestException(`Recurrence must be: ${VALID_RECURRENCE.join(", ")}`); })()
      : null;

    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      const assignee = await requireAssignee(
        q, u, b.assigneeId || (await defaultOwner(q, u)),
      );
      if (b.leadId) {
        const lead = await requireVisibleLead(q, u, v.uuid(b.leadId));
        const recipient = (
          await q.query(
            "SELECT u.*,r.code FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1",
            [assignee],
          )
        ).rows[0];
        const ids = await visibleUserIds(q, {
          ...u, sub: recipient.id, roleCode: recipient.code,
        });
        if (ids && !ids.includes(lead.owner_id))
          throw new BadRequestException("Task assignee must have access to the linked lead");
      }
      const r = await q.query(
        "INSERT INTO tasks(tenant_id,lead_id,assignee_id,created_by,title,due_at,recurrence_rule) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
        [
          u.tenantId,
          b.leadId || null,
          assignee,
          tenantUserId(u),
          v.str(b.title, "Task title", 240),
          v.date(b.dueAt, "Due date"),
          recurrence,
        ],
      );
      await this.db.audit(q, u.tenantId, u.sub, "task.created", "task", r.rows[0].id);

      // Email assignee if different from creator
      if (assignee !== u.sub) {
        const assigneeUser = (
          await q.query("SELECT name,email FROM users WHERE id=$1", [assignee])
        ).rows[0];
        if (assigneeUser?.email && r.rows[0].due_at) {
          const dueFormatted = new Date(r.rows[0].due_at).toLocaleDateString("en-IN", { dateStyle: "medium" });
          this.mail.sendTaskDueReminder(assigneeUser.email, assigneeUser.name, r.rows[0].title, dueFormatted).catch(() => null);
        }
      }
      return r.rows[0];
    });
  }

  async complete(u: any, id: string) {
    requirePermission(u, "task.write");
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      const ids = await visibleUserIds(q, u);
      const t = (
        await q.query(
          "SELECT * FROM tasks WHERE tenant_id=$1 AND id=$2 AND ($3::uuid[] IS NULL OR assignee_id=ANY($3))",
          [u.tenantId, v.uuid(id), ids],
        )
      ).rows[0];
      if (!t) throw new NotFoundException();
      if (t.lead_id) await requireVisibleLead(q, u, t.lead_id);
      const r = await q.query(
        "UPDATE tasks SET status='completed',completed_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING *",
        [u.tenantId, id],
      );
      await this.db.audit(q, u.tenantId, u.sub, "task.completed", "task", id);

      // BUG-07: if recurring, spawn the next occurrence
      if (t.recurrence_rule && t.due_at) {
        const nextDue = nextDueDate(new Date(t.due_at), t.recurrence_rule as Recurrence);
        await q.query(
          "INSERT INTO tasks(tenant_id,lead_id,assignee_id,created_by,title,due_at,recurrence_rule,recurrence_parent_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [u.tenantId, t.lead_id, t.assignee_id, t.created_by, t.title, nextDue.toISOString(), t.recurrence_rule, t.id],
        );
      }
      return r.rows[0];
    });
  }
}
