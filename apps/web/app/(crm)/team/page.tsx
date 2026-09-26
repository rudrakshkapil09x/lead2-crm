"use client";
import { useState } from "react";
import {
  Plus,
  UsersRound,
  Pencil,
  UserMinus,
  ShieldCheck,
  Search,
  Check,
  ChevronRight,
} from "lucide-react";
import { api, currentUser, can, date } from "../../../lib/api";
import {
  PageHead,
  Notice,
  Loading,
  Empty,
  Avatar,
  Badge,
  Modal,
  Field,
  useResource,
} from "../../../components/UI";
import UserFields from "../../../components/UserFields";
const blank = { name: "", email: "", password: "", roleId: "", managerId: "" };
export default function Team() {
  const me = currentUser(),
    manage = can(me, "user.manage");
  const { data, error, setError, reload } = useResource(() =>
    Promise.all([
      api("/users"),
      api("/users/roles"),
      api("/users/workspace"),
      manage ? api("/auth/requests") : Promise.resolve([]),
    ]),
  );
  const [tab, setTab] = useState("people"),
    [query, setQuery] = useState(""),
    [editing, setEditing] = useState<any>(null),
    [f, setF] = useState<any>(blank),
    [removing, setRemoving] = useState<any>(null),
    [replaceMode, setReplaceMode] = useState("existing"),
    [replacement, setReplacement] = useState(""),
    [reportManager, setReportManager] = useState(""),
    [newUser, setNewUser] = useState<any>(blank),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [authority, setAuthority] = useState<any>(null),
    [a, setA] = useState<any>({}),
    [member, setMember] = useState<any>(null),
    [reporting, setReporting] = useState<any>(null);
  if (!data) return error ? <Notice message={error} /> : <Loading />;
  const [users, roles, workspace, requests] = data,
    filtered = users.filter((u: any) =>
      (u.name + " " + u.email).toLowerCase().includes(query.toLowerCase()),
    );
  async function run(fn: () => Promise<any>, done?: () => void) {
    setBusy(true);
    setError("");
    try {
      await fn();
      done?.();
      await reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        eyebrow="GOOD TEAMS, CONNECTED"
        title="Team & access"
        description={
          manage
            ? "Set your team up with the right roles, reporting lines and authority."
            : "Your reporting tree, from team managers to individual contributors."
        }
        actions={
          manage && (
            <button
              className="btn"
              onClick={() => {
                setF({
                  ...blank,
                  roleId:
                    roles.find((r: any) => r.code === "sales_member")?.id || "",
                });
                setEditing({});
              }}
            >
              <Plus size={14} />
              Add team member
            </button>
          )
        }
      />
      <Notice message={error} onClose={() => setError("")} />
      <Notice message={notice} success onClose={() => setNotice("")} />
      {manage && (
        <div className="card" style={{ marginBottom: 25 }}>
          <div className="row spaced">
            <div className="person-cell">
              <span className="workspace-icon">
                <UsersRound size={18} />
              </span>
              <div>
                <h3>
                  {workspace.active_users} of {workspace.seat_limit} seats in
                  use
                </h3>
                <p className="subtle">
                  All active client users count toward your agreement.
                </p>
              </div>
            </div>
            <Badge
              tone={
                workspace.active_users >= workspace.seat_limit
                  ? "amber"
                  : "green"
              }
            >
              {workspace.seat_limit - workspace.active_users} seats available
            </Badge>
          </div>
          <div className="seat-bar">
            <span
              style={{
                width:
                  Math.min(
                    100,
                    (workspace.active_users / workspace.seat_limit) * 100,
                  ) + "%",
              }}
            />
          </div>
          <span className="subtle">
            {workspace.agreement?.reference
              ? "Agreement " + workspace.agreement.reference + " · "
              : ""}
            Contact Lead2 Ops to change your licensed seat count.
          </span>
        </div>
      )}
      <div className="tabs">
        <button
          className={tab === "people" ? "active" : ""}
          onClick={() => setTab("people")}
        >
          People & reporting
        </button>
        {manage && (
          <>
            <button
              className={tab === "authority" ? "active" : ""}
              onClick={() => setTab("authority")}
            >
              Authority matrix
            </button>
            <button
              className={tab === "requests" ? "active" : ""}
              onClick={() => setTab("requests")}
            >
              Join requests <Badge>{requests.length}</Badge>
            </button>
          </>
        )}
      </div>
      {tab === "people" && (
        <div className="card">
          <div className="toolbar">
            <div className="search-box">
              <Search size={15} />
              <input
                aria-label="Search team"
                placeholder="Find a teammate…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Badge>
              {users.filter((x: any) => x.active).length} active in view
            </Badge>
          </div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Team member</th>
                  <th>Role</th>
                  <th>Reports to</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u: any) => (
                  <tr key={u.id}>
                    <td>
                      <div className="person-cell">
                        <Avatar name={u.name} />
                        <div>
                          <b>
                            {u.name}
                            {u.id === me?.sub ? " (you)" : ""}
                          </b>
                          <small>{u.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>{u.role_name}</td>
                    <td>{u.manager_name || "—"}</td>
                    <td>
                      <Badge tone={u.active ? "green" : "neutral"}>
                        {u.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td>
                      <div className="row">
                        {manage && (
                          <button
                            className="icon-btn"
                            aria-label={"Edit " + u.name}
                            onClick={() => {
                              setF({
                                id: u.id,
                                name: u.name,
                                email: u.email,
                                roleId: u.role_id,
                                managerId: u.manager_id || "",
                                password: "",
                                active: u.active,
                              });
                              setEditing(u);
                            }}
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                        {u.id !== me?.sub &&
                          u.active &&
                          u.role_code !== "client_super_admin" && (
                            <>
                              <button
                                className="btn small ghost"
                                onClick={() => {
                                  setMember(u);
                                  setA({
                                    ...u.authority,
                                    ...u.authority_override,
                                  });
                                }}
                              >
                                Authority
                              </button>
                              <button
                                className="btn small ghost"
                                onClick={() => {
                                  setReporting(u);
                                  setReportManager(u.manager_id || "");
                                }}
                              >
                                Reporting
                              </button>
                            </>
                          )}
                        {manage && u.active && u.id !== me?.sub && (
                          <button
                            className="icon-btn"
                            aria-label={"Remove " + u.name}
                            onClick={() => {
                              setRemoving(u);
                              setReplacement("");
                              setReportManager("");
                              setNewUser({
                                ...blank,
                                roleId: u.role_id,
                                managerId: u.manager_id || "",
                              });
                            }}
                          >
                            <UserMinus size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filtered.length && <Empty title="No team members match" />}
        </div>
      )}
      {tab === "authority" && (
        <div className="stack">
          <div className="info-box">
            Data visibility is fixed by role: Sales Team Members see their own
            records, Managers see their reporting tree, and Client Super Admins
            see all workspace records. Permission and commercial limits are
            applied by the server.
          </div>
          <div className="cards-grid">
            {roles.map((r: any) => (
              <div className="card" key={r.id}>
                <div className="card-head">
                  <h2>{r.name}</h2>
                  <ShieldCheck size={18} color="#72967b" />
                </div>
                <Badge tone="green">
                  {r.code === "client_super_admin"
                    ? "All workspace records"
                    : r.code === "client_manager"
                      ? "Own + reporting tree"
                      : "Own records"}
                </Badge>
                <div className="divider" />
                <div className="stat-line">
                  <span>Self-authorized discount</span>
                  <b>{r.authority.selfDiscountPct}%</b>
                </div>
                <div className="stat-line">
                  <span>May approve discounts up to</span>
                  <b>{r.authority.approveDiscountPct}%</b>
                </div>
                <div className="stat-line">
                  <span>Approval total limit</span>
                  <b>{Number(r.authority.approveTotal).toLocaleString()}</b>
                </div>
                <p className="subtle" style={{ marginTop: 15 }}>
                  Amounts use the proposal’s currency. Limits apply separately
                  to each proposal.
                </p>
                {r.code !== "client_super_admin" && (
                  <button
                    className="btn ghost"
                    style={{ marginTop: 20 }}
                    onClick={() => {
                      setAuthority(r);
                      setA({ ...r.authority, permissions: r.permissions });
                    }}
                  >
                    Edit authority
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === "requests" && (
        <div className="card">
          {requests.map((r: any) => (
            <div className="focus-item" key={r.id}>
              <Avatar name={r.name} />
              <div style={{ flex: 1 }}>
                <b>{r.name}</b>
                <small>
                  {r.email} · {date(r.created_at)}
                </small>
              </div>
              <button
                className="btn ghost"
                disabled={busy}
                onClick={() =>
                  run(() =>
                    api("/auth/requests/" + r.id + "/reject", {
                      method: "POST",
                      body: JSON.stringify({
                        note: "Declined by Client Super Admin",
                      }),
                    }),
                  )
                }
              >
                Decline
              </button>
              <button
                className="btn"
                disabled={busy}
                onClick={() =>
                  run(
                    () =>
                      api("/auth/requests/" + r.id + "/approve", {
                        method: "POST",
                        body: "{}",
                      }),
                    () =>
                      setNotice(
                        "Access approved. Assign a manager from People & reporting.",
                      ),
                  )
                }
              >
                Approve access
              </button>
            </div>
          ))}
          {!requests.length && <Empty title="No pending join requests" />}
        </div>
      )}
      {editing && (
        <Modal
          title={editing.id ? "Edit team member" : "Add team member"}
          onClose={() => setEditing(null)}
        >
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                () =>
                  api(editing.id ? "/users/" + editing.id : "/users", {
                    method: editing.id ? "PATCH" : "POST",
                    body: JSON.stringify(f),
                  }),
                () => {
                  setEditing(null);
                  setNotice(
                    editing.id
                      ? "User updated"
                      : "User created. Share their temporary password securely.",
                  );
                },
              );
            }}
          >
            <Notice message={error} />
            <UserFields
              f={f}
              setF={setF}
              roles={roles}
              users={users}
              passwordRequired={!editing.id}
            />
            {editing.id && !editing.active && (
              <label className="row">
                <input
                  type="checkbox"
                  checked={f.active}
                  onChange={(e) => setF({ ...f, active: e.target.checked })}
                />
                Reactivate user (uses one seat)
              </label>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button className="btn" disabled={busy}>
                {busy ? "Saving…" : "Save user"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {removing && (
        <Modal
          title={"Remove & replace " + removing.name}
          wide
          onClose={() => setRemoving(null)}
        >
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                () =>
                  api("/users/" + removing.id + "/remove", {
                    method: "POST",
                    body: JSON.stringify({
                      replacementId:
                        replaceMode === "existing" ? replacement : undefined,
                      newUser: replaceMode === "new" ? newUser : undefined,
                      reporteesManagerId: reportManager || undefined,
                    }),
                  }),
                () => {
                  setRemoving(null);
                  setNotice(
                    "User removed and records transferred. Their session has been revoked.",
                  );
                },
              );
            }}
          >
            <Notice message={error} />
            <div className="info-box">
              The account will become inactive. Leads, open tasks and proposal
              ownership will transfer together. Historical activity and
              authorship are preserved.
            </div>
            <div className="segmented">
              <button
                type="button"
                className={replaceMode === "existing" ? "active" : ""}
                onClick={() => setReplaceMode("existing")}
              >
                Existing replacement
              </button>
              <button
                type="button"
                className={replaceMode === "new" ? "active" : ""}
                onClick={() => setReplaceMode("new")}
              >
                Create new replacement
              </button>
            </div>
            {replaceMode === "existing" ? (
              <Field label="Transfer records to">
                <select
                  required
                  className="input"
                  value={replacement}
                  onChange={(e) => setReplacement(e.target.value)}
                >
                  <option value="">Choose active team member</option>
                  {users
                    .filter((x: any) => x.active && x.id !== removing.id)
                    .map((x: any) => (
                      <option value={x.id} key={x.id}>
                        {x.name}
                      </option>
                    ))}
                </select>
              </Field>
            ) : (
              <UserFields
                f={newUser}
                setF={setNewUser}
                roles={roles}
                users={users.filter((x: any) => x.id !== removing.id)}
              />
            )}
            <Field label="Reporting manager for their reportees (if applicable)">
              <select
                className="input"
                value={reportManager}
                onChange={(e) => setReportManager(e.target.value)}
              >
                <option value="">
                  Use replacement or replacement’s manager
                </option>
                {users
                  .filter(
                    (x: any) =>
                      x.active &&
                      x.role_code !== "sales_member" &&
                      x.id !== removing.id,
                  )
                  .map((x: any) => (
                    <option value={x.id} key={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
            </Field>
            <div className="form-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => setRemoving(null)}
              >
                Cancel
              </button>
              <button className="btn danger" disabled={busy}>
                {busy ? "Transferring…" : "Remove & transfer"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {(authority || member) && (
        <Modal
          title={
            authority
              ? "Edit " + authority.name + " authority"
              : "Authority for " + member.name
          }
          onClose={() => {
            setAuthority(null);
            setMember(null);
          }}
        >
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                () =>
                  api(
                    authority
                      ? "/users/roles/" + authority.id
                      : "/users/" + member.id + "/authority",
                    { method: "PATCH", body: JSON.stringify(a) },
                  ),
                () => {
                  setAuthority(null);
                  setMember(null);
                  setNotice("Authority updated");
                },
              );
            }}
          >
            <Notice message={error} />
            <div className="info-box">
              {member
                ? "Member limits may be lower than their role limits and cannot exceed your own authority."
                : "Configure the actions and limits for this role. Managers cannot gain platform or user administration privileges."}
            </div>
            {[
              ["selfDiscountPct", "Self-authorized discount (%)"],
              ["approveDiscountPct", "Maximum approval discount (%)"],
              ["approveTotal", "Maximum proposal total to approve"],
            ].map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  required
                  min={0}
                  max={key === "approveTotal" ? 999999999999 : 100}
                  step="0.01"
                  className="input"
                  type="number"
                  value={a[key]}
                  onChange={(e) =>
                    setA({ ...a, [key]: Number(e.target.value) })
                  }
                />
              </Field>
            ))}
            {authority && (
              <div className="matrix-checks">
                {[
                  "lead.read",
                  "lead.write",
                  ...(authority.code === "client_manager"
                    ? [
                        "lead.assign",
                        "lead.delete",
                        "team.manage",
                        "proposal.approve",
                      ]
                    : []),
                  "task.write",
                  "report.read",
                  "proposal.write",
                ].map((p) => (
                  <label key={p}>
                    <input
                      type="checkbox"
                      disabled={p === "lead.read"}
                      checked={a.permissions?.includes(p)}
                      onChange={(e) =>
                        setA({
                          ...a,
                          permissions: e.target.checked
                            ? [...a.permissions, p]
                            : a.permissions.filter((x: string) => x !== p),
                        })
                      }
                    />
                    {p}
                  </label>
                ))}
              </div>
            )}
            <button className="btn" disabled={busy}>
              Save authority
            </button>
          </form>
        </Modal>
      )}
      {reporting && (
        <Modal
          title={"Reporting line for " + reporting.name}
          onClose={() => setReporting(null)}
        >
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                () =>
                  api("/users/" + reporting.id + "/reporting", {
                    method: "PATCH",
                    body: JSON.stringify({ managerId: reportManager || null }),
                  }),
                () => setReporting(null),
              );
            }}
          >
            <Notice message={error} />
            <Field label="Reports to">
              <select
                required={!manage}
                className="input"
                value={reportManager}
                onChange={(e) => setReportManager(e.target.value)}
              >
                <option value="">No reporting manager</option>
                {users
                  .filter(
                    (x: any) =>
                      x.active &&
                      x.role_code !== "sales_member" &&
                      x.id !== reporting.id,
                  )
                  .map((x: any) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
            </Field>
            <button className="btn" disabled={busy}>
              Update reporting
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
