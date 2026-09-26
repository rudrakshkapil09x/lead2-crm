"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  Plus,
  UsersRound,
  Wallet,
  TrendingUp,
  Clock3,
  CalendarDays,
  ChevronRight,
  FileText,
} from "lucide-react";
import { api, currentUser, shortMoney, money, date } from "../../../lib/api";
import {
  PageHead,
  Notice,
  Loading,
  Empty,
  Avatar,
  Badge,
  useResource,
} from "../../../components/UI";
export default function Dashboard() {
  const { data, error } = useResource(() =>
    Promise.all([
      api("/dashboard"),
      api("/tasks?status=open"),
      api("/proposals"),
    ]),
  );
  if (error) return <Notice message={error} />;
  if (!data) return <Loading />;
  const [d, tasks, proposals] = data,
    u = currentUser(),
    k = d.kpis,
    stages = d.stages.filter(
      (s: any) => s.probability > 0 && s.probability < 100,
    ),
    max = Math.max(1, ...stages.map((s: any) => Number(s.value))),
    pending = proposals.filter((x: any) => x.status === "approval_required");
  const stats = [
    {
      label: "Pipeline value",
      value: shortMoney(k.total_value, d.currency),
      icon: Wallet,
      foot: "Across open opportunities",
      tag: k.open_leads + " open",
    },
    {
      label: "Weighted forecast",
      value: shortMoney(k.weighted_value, d.currency),
      icon: TrendingUp,
      foot: "Based on stage probability",
      tag: "Forecast",
    },
    {
      label: "Open leads",
      value: k.open_leads,
      icon: UsersRound,
      foot: "Created this month",
      tag: "+" + k.new_this_month,
    },
    {
      label: "Needs attention",
      value: k.overdueTasks,
      icon: Clock3,
      foot: "Tasks past their due date",
      tag: "Follow up",
    },
  ];
  return (
    <>
      <PageHead
        eyebrow="YOUR WORKSPACE, AT A GLANCE"
        title={`Welcome back, ${u?.name?.split(" ")[0] || "there"}.`}
        description="A clear view of your pipeline. A confident next move."
        actions={
          <>
            <span className="btn ghost">
              <CalendarDays size={14} />
              {date(new Date())}
            </span>
            <Link href="/leads?new=1" className="btn">
              <Plus size={14} />
              New lead
            </Link>
          </>
        }
      />
      <div className="grid kpis">
        {stats.map((s) => (
          <div className="card kpi" key={s.label}>
            <div className="kpi-top">
              {s.label}
              <span className="kpi-icon">
                <s.icon size={16} />
              </span>
            </div>
            <strong>{s.value}</strong>
            <p>
              <span className="trend">{s.tag}</span>
              {s.foot}
            </p>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Pipeline at a glance</h2>
              <p>Open opportunity value by stage</p>
            </div>
            <Link href="/pipeline" className="text-link">
              View pipeline <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="bar-chart">
            {stages.map((s: any) => (
              <div className="chart-column" key={s.id}>
                <b>{shortMoney(s.value, d.currency)}</b>
                <div
                  className="chart-bar"
                  title={`${s.name}: ${s.count} leads, ${money(s.value, d.currency)}`}
                  style={{
                    height: Math.max(3, (Number(s.value) / max) * 146),
                    background: s.color,
                    opacity: 0.72,
                  }}
                />
                <small>{s.name}</small>
              </div>
            ))}
          </div>
          <div className="chart-foot">
            <span>
              Avg. lead age <b>{k.avg_open_age_days} days</b>
            </span>
            <span>
              Won this month <b>{k.won_this_month}</b>
            </span>
          </div>
        </section>
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Your next moves</h2>
              <p>Keep the important things moving</p>
            </div>
            <Clock3 size={17} color="#a7b6aa" />
          </div>
          {pending.length > 0 && (
            <Link className="focus-item" href="/proposals">
              <span className="focus-icon">
                <FileText size={17} />
              </span>
              <div>
                <b>
                  {pending.length} proposal{pending.length === 1 ? "" : "s"}{" "}
                  awaiting approval
                </b>
                <small>Review before sharing with customers</small>
              </div>
              <ChevronRight size={16} />
            </Link>
          )}
          {tasks.slice(0, 3).map((t: any) => (
            <Link href="/tasks" className="focus-item" key={t.id}>
              <span
                className="focus-icon"
                style={{ background: "#edf3ec", color: "#7d9e7b" }}
              >
                <CalendarDays size={16} />
              </span>
              <div>
                <b>{t.title}</b>
                <small>
                  {t.lead_name || t.assignee_name} · {date(t.due_at)}
                </small>
              </div>
              {t.due_at && new Date(t.due_at) < new Date() && (
                <Badge tone="amber">Overdue</Badge>
              )}
            </Link>
          ))}
          {!tasks.length && !pending.length && (
            <Empty
              title="All caught up"
              text="Your upcoming tasks and approvals will appear here."
            />
          )}
          <Link
            href="/tasks"
            className="text-link"
            style={{ display: "block", marginTop: 20 }}
          >
            All tasks <span>→</span>
          </Link>
        </section>
      </div>
      <section className="card" style={{ marginBottom: 22 }}>
        <div className="card-head">
          <div>
            <h2>Recent opportunities</h2>
            <p>Every conversation is a place to start</p>
          </div>
          <Link href="/leads" className="text-link">
            View all leads →
          </Link>
        </div>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Lead / company</th>
                <th>Stage</th>
                <th>Deal value</th>
                <th>Owner</th>
                <th>Stage age</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {d.recentLeads.map((l: any) => (
                <tr key={l.id}>
                  <td>
                    <Link className="person-cell" href={"/leads/" + l.id}>
                      <Avatar name={l.name} small />
                      <div>
                        <b>{l.name}</b>
                        <small>{l.company || "Individual"}</small>
                      </div>
                    </Link>
                  </td>
                  <td>
                    <Badge tone={l.stage_name.toLowerCase()}>
                      <span
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: 4,
                          background: l.stage_color,
                        }}
                      />
                      {l.stage_name}
                    </Badge>
                  </td>
                  <td>
                    <b>{money(l.value, d.currency)}</b>
                  </td>
                  <td>{l.owner_name}</td>
                  <td>
                    <Badge tone={l.stage_age_days > 14 ? "amber" : "neutral"}>
                      {l.stage_age_days} days
                    </Badge>
                  </td>
                  <td>{date(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!d.recentLeads.length && (
          <Empty
            title="Your pipeline starts here"
            text="Add your first lead to see live sales insights."
            action={
              <Link className="btn" href="/leads?new=1">
                Add a lead
              </Link>
            }
          />
        )}
      </section>
      <div className="dashboard-grid equal">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Team performance</h2>
              <p>{d.scope}</p>
            </div>
            <UsersRound size={17} color="#a7b6aa" />
          </div>
          {d.owners.map((o: any, i: number) => (
            <div className="progress-row" key={i}>
              <div className="row spaced">
                <div className="person-cell">
                  <Avatar name={o.owner} small />
                  <div>
                    <b style={{ fontSize: 11 }}>{o.owner}</b>
                    <div className="subtle">
                      {o.count} leads · {o.won} won
                    </div>
                  </div>
                </div>
                <b style={{ fontSize: 12 }}>
                  {shortMoney(o.open_value, d.currency)}
                </b>
              </div>
              <div className="bar">
                <span
                  style={{
                    width:
                      (Number(o.open_value) /
                        Math.max(1, Number(k.total_value))) *
                        100 +
                      "%",
                  }}
                />
              </div>
            </div>
          ))}
          {!d.owners.length && <Empty title="Team insights will appear here" />}
        </section>
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Where opportunities begin</h2>
              <p>Performance across your lead sources</p>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Leads</th>
                <th>Won</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {d.sources.map((s: any) => (
                <tr key={s.source}>
                  <td>
                    <b>{s.source}</b>
                  </td>
                  <td>{s.count}</td>
                  <td>{s.won}</td>
                  <td>{shortMoney(s.value, d.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!d.sources.length && <Empty title="No sources yet" />}
        </section>
      </div>
      <div className="page-footer">
        <span>
          <span className="live-dot" /> Live workspace data · {d.scope}
        </span>
        <span>Lead2 CRM</span>
      </div>
    </>
  );
}
