import { Injectable } from "@nestjs/common";
import { DbService } from "../db/db.service";
import { requirePermission, visibleUserIds } from "../common/permissions";
@Injectable()
export class DashboardService {
  constructor(private db: DbService) {}
  async get(u: any) {
    requirePermission(u, "report.read");
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      const ids = await visibleUserIds(q, u),
        params = [u.tenantId, ids],
        scope = "l.tenant_id=$1 AND ($2::uuid[] IS NULL OR l.owner_id=ANY($2))";
      const age = "extract(epoch from (now()-l.created_at))/86400.0",
        stageAge = "extract(epoch from (now()-l.stage_entered_at))/86400.0";
      const k = (
        await q.query(
          `SELECT count(*)::int leads,count(*) FILTER(WHERE l.status='open')::int open_leads,
   count(*) FILTER(WHERE l.created_at>=date_trunc('month',now()))::int new_this_month,
   count(*) FILTER(WHERE l.status='won' AND l.closed_at>=date_trunc('month',now()))::int won_this_month,
   coalesce(sum(l.value) FILTER(WHERE l.status='open'),0) total_value,
   coalesce(sum(l.value*s.probability/100.0) FILTER(WHERE l.status='open'),0) weighted_value,
   round(coalesce(avg(${age}) FILTER(WHERE l.status='open'),0),1) avg_open_age_days,
   round(coalesce(avg(${stageAge}) FILTER(WHERE l.status='open'),0),1) avg_stage_age_days
   FROM leads l JOIN pipeline_stages s ON s.id=l.stage_id WHERE ${scope}`,
          params,
        )
      ).rows[0];
      const stages = (
        await q.query(
          `SELECT s.id,s.name,s.color,s.position,s.probability,count(l.id)::int count,coalesce(sum(l.value),0) value,
   round(coalesce(avg(${stageAge}),0),1) current_avg_age_days,round(coalesce(max(${stageAge}),0),1) oldest_age_days
   FROM pipeline_stages s LEFT JOIN leads l ON l.stage_id=s.id AND l.status='open' AND l.tenant_id=$1 AND ($2::uuid[] IS NULL OR l.owner_id=ANY($2))
   WHERE s.tenant_id=$1 GROUP BY s.id ORDER BY s.position`,
          params,
        )
      ).rows;
      const history = (
        await q.query(
          `SELECT h.stage_id,round(avg(extract(epoch from(h.exited_at-h.entered_at))/86400.0),1) historical_avg_age_days,count(*)::int completed_transitions FROM lead_stage_history h JOIN leads l ON l.id=h.lead_id WHERE ${scope} AND h.exited_at IS NOT NULL GROUP BY h.stage_id`,
          params,
        )
      ).rows;
      for (const s of stages)
        Object.assign(
          s,
          history.find((x) => x.stage_id === s.id) || {
            historical_avg_age_days: null,
            completed_transitions: 0,
          },
        );
      const overdue = (
        await q.query(
          "SELECT count(*)::int n FROM tasks WHERE tenant_id=$1 AND status='open' AND due_at<now() AND ($2::uuid[] IS NULL OR assignee_id=ANY($2))",
          params,
        )
      ).rows[0].n;
      const ageingBuckets = (
        await q.query(
          `SELECT bucket,count(*)::int count,coalesce(sum(value),0) value FROM (SELECT l.value,CASE WHEN ${stageAge}<4 THEN '0-3 days' WHEN ${stageAge}<8 THEN '4-7 days' WHEN ${stageAge}<15 THEN '8-14 days' WHEN ${stageAge}<31 THEN '15-30 days' ELSE '31+ days' END bucket,CASE WHEN ${stageAge}<4 THEN 1 WHEN ${stageAge}<8 THEN 2 WHEN ${stageAge}<15 THEN 3 WHEN ${stageAge}<31 THEN 4 ELSE 5 END ord FROM leads l WHERE ${scope} AND l.status='open') x GROUP BY bucket,ord ORDER BY ord`,
          params,
        )
      ).rows;
      const sources = (
        await q.query(
          `SELECT coalesce(nullif(l.source,''),'Unspecified') source,count(*)::int count,coalesce(sum(l.value),0) value,count(*) FILTER(WHERE l.status='won')::int won FROM leads l WHERE ${scope} GROUP BY coalesce(nullif(l.source,''),'Unspecified') ORDER BY count DESC,value DESC LIMIT 10`,
          params,
        )
      ).rows;
      const owners = (
        await q.query(
          `SELECT u.id owner_id,coalesce(u.name,'Unassigned') owner,count(l.id)::int count,count(l.id) FILTER(WHERE l.status='won')::int won,coalesce(sum(l.value) FILTER(WHERE l.status='open'),0) open_value,round(coalesce(avg(${stageAge}) FILTER(WHERE l.status='open'),0),1) avg_stage_age_days FROM leads l LEFT JOIN users u ON u.id=l.owner_id WHERE ${scope} GROUP BY u.id,u.name ORDER BY open_value DESC,count DESC LIMIT 12`,
          params,
        )
      ).rows;
      const recentLeads = (
        await q.query(
          `SELECT l.id,l.name,l.company,l.value,l.created_at,l.stage_entered_at,floor(${age})::int lead_age_days,floor(${stageAge})::int stage_age_days,s.name stage_name,s.color stage_color,u.name owner_name FROM leads l JOIN pipeline_stages s ON s.id=l.stage_id LEFT JOIN users u ON u.id=l.owner_id WHERE ${scope} ORDER BY l.created_at DESC LIMIT 6`,
          params,
        )
      ).rows;
      return {
        currency: u.currency || "INR",
        scope:
          u.roleCode === "client_manager"
            ? "Your reporting tree"
            : u.roleCode === "sales_member"
              ? "Your records"
              : "All workspace records",
        kpis: { ...k, overdueTasks: overdue },
        stages,
        ageingBuckets,
        sources,
        owners,
        recentLeads,
      };
    });
  }
}
