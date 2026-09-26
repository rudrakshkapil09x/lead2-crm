"use client";
import PasswordDialog from "../../components/PasswordDialog";
import { useEffect, useState } from "react";
import {
  Building2,
  UsersRound,
  ShieldCheck,
  Clock3,
  Plus,
  Pencil,
  ArrowUpRight,
} from "lucide-react";
import {
  api,
  currentUser,
  setSession,
  signOut,
  money,
  date,
  label,
} from "../../lib/api";
import {
  PageHead,
  Notice,
  Loading,
  Empty,
  Badge,
  Modal,
  Field,
  Avatar,
  CURRENCIES,
} from "../../components/UI";
import { Logo } from "../../components/AuthPage";
const agreementBlank = {
  seatLimit: 5,
  reference: "",
  plan: "Standard",
  amount: 0,
  currency: "INR",
  billingCycle: "annual",
  startDate: "",
  endDate: "",
  status: "active",
};
export default function Platform() {
  const [me, setMe] = useState<any>(null),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState("clients"),
    [editing, setEditing] = useState<any>(null),
    [approving, setApproving] = useState<any>(null),
    [rejecting, setRejecting] = useState<any>(null),
    [f, setF] = useState<any>(agreementBlank),
    [note, setNote] = useState(""),
    [staffForm, setStaffForm] = useState(false),
    [staff, setStaff] = useState({ name: "", email: "", password: "" }),
    [busy, setBusy] = useState(false);
  async function load(u?: any) {
    try {
      const current = u || me || (await api("/auth/me"));
      if (!current.platformAdmin) {
        location.href = "/dashboard";
        return;
      }
      if (current.tenantId) {
        await api("/auth/super-admin/context", { method: "POST", body: "{}" });
        current.tenantId = undefined;
      }
      setMe(current);
      setSession(current);
      const values = await Promise.all([
        api("/auth/super-admin/summary"),
        api("/auth/super-admin/requests"),
        api("/auth/super-admin/audit"),
        current.roleCode === "lead2_engineer"
          ? api("/auth/super-admin/staff")
          : Promise.resolve([]),
      ]);
      setData(values);
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function run(fn: () => Promise<any>, done?: () => void) {
    setBusy(true);
    setError("");
    try {
      await fn();
      done?.();
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!me || !data)
    return error ? (
      <div className="main">
        <Notice message={error} />
        <a className="btn" href="/super-admin/login">
          Platform sign in
        </a>
      </div>
    ) : (
      <Loading />
    );
  const [summary, requests, audit, staffList] = data;
  return (
    <div className="platform-shell">
      <header className="platform-head">
        <Logo />
        <div className="row">
          <Badge tone="green">Lead2 control center</Badge>
          <Avatar name={me.name} small />
          <span className="muted">
            {me.name} · {me.role}
          </span>
          <PasswordDialog platform />
          <button className="btn ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>
      <PageHead
        eyebrow="PLATFORM OPERATIONS"
        title="A clear view of every client."
        description="Activate workspaces, manage commercial agreements, and keep access in balance."
      />
      <Notice message={error} onClose={() => setError("")} />
      <div className="grid kpis">
        {[
          {
            title: "Active workspaces",
            value: summary.kpis.active_tenants,
            icon: Building2,
          },
          {
            title: "Pending approvals",
            value: summary.kpis.pending_requests,
            icon: Clock3,
          },
          {
            title: "Licensed seats",
            value: summary.kpis.licensed_seats,
            icon: UsersRound,
          },
          {
            title: "Seats in use",
            value: summary.tenants.reduce(
              (n: number, t: any) => n + t.active_users,
              0,
            ),
            icon: ShieldCheck,
          },
        ].map((k) => (
          <div className="card kpi" key={k.title}>
            <div className="kpi-top">
              {k.title}
              <span className="kpi-icon">
                <k.icon size={16} />
              </span>
            </div>
            <strong>{k.value}</strong>
            <p>Across client workspaces</p>
          </div>
        ))}
      </div>
      <div className="tabs">
        <button
          className={tab === "clients" ? "active" : ""}
          onClick={() => setTab("clients")}
        >
          Client workspaces
        </button>
        <button
          className={tab === "requests" ? "active" : ""}
          onClick={() => setTab("requests")}
        >
          New workspace requests <Badge>{requests.length}</Badge>
        </button>
        <button
          className={tab === "audit" ? "active" : ""}
          onClick={() => setTab("audit")}
        >
          Platform activity
        </button>
        {me.roleCode === "lead2_engineer" && (
          <button
            className={tab === "staff" ? "active" : ""}
            onClick={() => setTab("staff")}
          >
            Lead2 team
          </button>
        )}
      </div>
      {tab === "clients" && (
        <div className="card">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Workspace</th>
                  <th>Agreement</th>
                  <th>License utilization</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {summary.tenants.map((t: any) => (
                  <tr key={t.id}>
                    <td>
                      <b>{t.name}</b>
                      <small>{t.slug}</small>
                    </td>
                    <td>
                      {t.agreement.reference || "Legacy agreement"}
                      <small>
                        {t.agreement.plan || "Standard"}
                        {t.agreement.currency
                          ? " · " +
                            money(t.agreement.amount, t.agreement.currency)
                          : ""}
                      </small>
                    </td>
                    <td>
                      <b>
                        {t.active_users} / {t.seat_limit} seats
                      </b>
                      <div
                        className="seat-bar"
                        style={{ width: 120, margin: "8px 0 0" }}
                      >
                        <span
                          style={{
                            width:
                              Math.min(
                                100,
                                (t.active_users / t.seat_limit) * 100,
                              ) + "%",
                          }}
                        />
                      </div>
                    </td>
                    <td>
                      <Badge tone={t.status === "active" ? "green" : "amber"}>
                        {label(t.status)}
                      </Badge>
                    </td>
                    <td>
                      <div className="row">
                        <button
                          className="btn ghost small"
                          onClick={() => {
                            setEditing(t);
                            setF({
                              ...agreementBlank,
                              ...t.agreement,
                              seatLimit: t.seat_limit,
                              status: t.status,
                            });
                          }}
                        >
                          <Pencil size={12} />
                          Agreement & seats
                        </button>
                        {me.roleCode === "lead2_engineer" && (
                          <button
                            className="btn small"
                            onClick={async () => {
                              try {
                                await api("/auth/super-admin/context", {
                                  method: "POST",
                                  body: JSON.stringify({ tenantId: t.id }),
                                });
                                location.href = "/dashboard";
                              } catch (e: any) {
                                setError(e.message);
                              }
                            }}
                          >
                            Open workspace
                            <ArrowUpRight size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!summary.tenants.length && (
            <Empty
              title="Your first client is next"
              text="Approve a workspace request to create the client’s workspace."
            />
          )}
        </div>
      )}
      {tab === "requests" && (
        <div className="card">
          {requests.map((r: any) => (
            <div className="focus-item" key={r.id}>
              <Avatar name={r.tenant_name} />
              <div style={{ flex: 1 }}>
                <b>{r.tenant_name}</b>
                <small>
                  {r.name} · {r.email} · {date(r.created_at)}
                </small>
              </div>
              <button
                className="btn ghost"
                onClick={() => {
                  setRejecting(r);
                  setNote("");
                }}
              >
                Decline
              </button>
              <button
                className="btn"
                onClick={() => {
                  setApproving(r);
                  setF({ ...agreementBlank });
                }}
              >
                Review & activate
              </button>
            </div>
          ))}
          {!requests.length && (
            <Empty
              title="No pending workspace requests"
              text="New companies can request access from the registration page."
            />
          )}
        </div>
      )}
      {tab === "audit" && (
        <div className="card">
          <div className="card-head">
            <h2>Platform activity</h2>
            <Badge>Last 200 events</Badge>
          </div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Workspace</th>
                  <th>Actor</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a: any) => (
                  <tr key={a.id}>
                    <td>
                      <b>
                        {a.action.replaceAll(".", " · ").replaceAll("_", " ")}
                      </b>
                    </td>
                    <td>{a.tenant_name || "Platform"}</td>
                    <td>{a.actor_name}</td>
                    <td>{new Date(a.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {tab === "staff" && (
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Lead2 team</h2>
              <p>
                Engineer accounts are created at the command line. Ops accounts
                can be managed here.
              </p>
            </div>
            <button className="btn" onClick={() => setStaffForm(true)}>
              <Plus size={13} />
              Add Ops member
            </button>
          </div>
          {staffList.map((s: any) => (
            <div className="focus-item" key={s.id}>
              <Avatar name={s.name} />
              <div style={{ flex: 1 }}>
                <b>{s.name}</b>
                <small>
                  {s.email} ·{" "}
                  {s.role === "lead2_engineer" ? "Engineer" : "Approver / Ops"}
                </small>
              </div>
              <Badge tone={s.active ? "green" : "neutral"}>
                {s.active ? "Active" : "Inactive"}
              </Badge>
              {s.role === "lead2_ops" && (
                <button
                  className="btn ghost small"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      api("/auth/super-admin/staff/" + s.id, {
                        method: "PATCH",
                        body: JSON.stringify({ active: !s.active }),
                      }),
                    )
                  }
                >
                  {s.active ? "Deactivate" : "Reactivate"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {(editing || approving) && (
        <Modal
          title={
            approving
              ? "Activate " + approving.tenant_name
              : "Commercial agreement · " + editing.name
          }
          wide
          onClose={() => {
            setEditing(null);
            setApproving(null);
          }}
        >
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                () =>
                  api(
                    approving
                      ? "/auth/super-admin/requests/" +
                          approving.id +
                          "/approve"
                      : "/auth/super-admin/tenants/" + editing.id,
                    {
                      method: approving ? "POST" : "PATCH",
                      body: JSON.stringify(f),
                    },
                  ),
                () => {
                  setEditing(null);
                  setApproving(null);
                },
              );
            }}
          >
            <Notice message={error} />
            <div className="info-box">
              {approving
                ? `${approving.name} will become the Client Super Admin. The workspace is created with this seat allowance.`
                : "All active Client Super Admins, Managers and Sales Team Members count as licensed seats. A license cannot be reduced below active usage."}
            </div>
            <div className="form-grid">
              <Field label="Agreement reference">
                <input
                  required
                  className="input"
                  placeholder="e.g. L2-ACME-2026"
                  value={f.reference}
                  onChange={(e) => setF({ ...f, reference: e.target.value })}
                />
              </Field>
              <Field label="Licensed user seats">
                <input
                  required
                  type="number"
                  min="1"
                  max="100000"
                  className="input"
                  value={f.seatLimit}
                  onChange={(e) => setF({ ...f, seatLimit: e.target.value })}
                />
              </Field>
              <Field label="Plan / package">
                <input
                  required
                  className="input"
                  value={f.plan}
                  onChange={(e) => setF({ ...f, plan: e.target.value })}
                />
              </Field>
              <Field label="Agreement amount">
                <input
                  required
                  type="number"
                  min="0"
                  step=".01"
                  className="input"
                  value={f.amount}
                  onChange={(e) => setF({ ...f, amount: e.target.value })}
                />
              </Field>
              <Field label="Currency">
                <select
                  className="input"
                  value={f.currency}
                  onChange={(e) => setF({ ...f, currency: e.target.value })}
                >
                  {CURRENCIES.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Billing cycle">
                <select
                  className="input"
                  value={f.billingCycle}
                  onChange={(e) => setF({ ...f, billingCycle: e.target.value })}
                >
                  {["annual", "monthly", "one_time"].map((x) => (
                    <option key={x} value={x}>
                      {label(x)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Start date (optional)">
                <input
                  className="input"
                  type="date"
                  value={f.startDate || ""}
                  onChange={(e) => setF({ ...f, startDate: e.target.value })}
                />
              </Field>
              <Field label="End date (optional)">
                <input
                  className="input"
                  type="date"
                  value={f.endDate || ""}
                  onChange={(e) => setF({ ...f, endDate: e.target.value })}
                />
              </Field>
            </div>
            {editing && (
              <Field label="Workspace access">
                <select
                  className="input"
                  value={f.status}
                  onChange={(e) => setF({ ...f, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </Field>
            )}
            <p className="subtle">
              An end date stops client access after that date. Suspension takes
              effect on the next request.
            </p>
            <div className="form-actions">
              <button className="btn" disabled={busy}>
                {busy
                  ? "Saving…"
                  : approving
                    ? "Approve & activate workspace"
                    : "Save agreement"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {rejecting && (
        <Modal
          title="Decline workspace request"
          onClose={() => setRejecting(null)}
        >
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                () =>
                  api(
                    "/auth/super-admin/requests/" + rejecting.id + "/reject",
                    { method: "POST", body: JSON.stringify({ note }) },
                  ),
                () => setRejecting(null),
              );
            }}
          >
            <Notice message={error} />
            <Field label="Review note">
              <textarea
                required
                className="input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <button className="btn danger" disabled={busy}>
              Decline request
            </button>
          </form>
        </Modal>
      )}
      {staffForm && (
        <Modal title="Add Lead2 Ops member" onClose={() => setStaffForm(false)}>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                () =>
                  api("/auth/super-admin/staff", {
                    method: "POST",
                    body: JSON.stringify(staff),
                  }),
                () => {
                  setStaffForm(false);
                  setStaff({ name: "", email: "", password: "" });
                },
              );
            }}
          >
            <Notice message={error} />
            {[
              ["name", "Full name"],
              ["email", "Work email"],
              ["password", "Initial password"],
            ].map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  required
                  className="input"
                  type={
                    key === "password"
                      ? "password"
                      : key === "email"
                        ? "email"
                        : "text"
                  }
                  minLength={key === "password" ? 12 : undefined}
                  value={(staff as any)[key]}
                  onChange={(e) =>
                    setStaff({ ...staff, [key]: e.target.value })
                  }
                />
              </Field>
            ))}
            <div className="info-box">
              Ops members can approve new client workspaces and manage
              agreements. They do not have access to client CRM records.
            </div>
            <button className="btn" disabled={busy}>
              Create Ops account
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
