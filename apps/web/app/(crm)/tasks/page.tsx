"use client";
import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { api, currentUser, can, date } from "../../../lib/api";
import {
  PageHead,
  Notice,
  Loading,
  Empty,
  Badge,
  Field,
  Modal,
  useResource,
} from "../../../components/UI";
export default function Tasks() {
  const { data, error, setError, reload } = useResource(() =>
      Promise.all([api("/tasks"), api("/leads"), api("/users")]),
    ),
    [show, setShow] = useState(false),
    [tab, setTab] = useState("open"),
    [f, setF] = useState<any>({
      title: "",
      leadId: "",
      assigneeId: currentUser()?.platformAdmin ? "" : currentUser()?.sub || "",
      dueAt: "",
    }),
    [busy, setBusy] = useState(false);
  if (!data) return error ? <Notice message={error} /> : <Loading />;
  const [tasks, leads, users] = data,
    filtered = tasks.filter((x: any) =>
      tab === "completed"
        ? x.status === "completed"
        : tab === "overdue"
          ? x.status === "open" && x.due_at && new Date(x.due_at) < new Date()
          : x.status === "open",
    );
  return (
    <>
      <PageHead
        eyebrow="MAKE ROOM FOR WHAT’S NEXT"
        title="Tasks"
        description="Stay close to your customers. Keep every follow-up in view."
        actions={
          can(currentUser(), "task.write") && (
            <button className="btn" onClick={() => setShow(true)}>
              <Plus size={14} />
              New task
            </button>
          )
        }
      />
      <Notice message={error} onClose={() => setError("")} />
      <div className="tabs">
        {["open", "overdue", "completed"].map((x) => (
          <button
            key={x}
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
          >
            {x[0].toUpperCase() + x.slice(1)}
          </button>
        ))}
      </div>
      <div className="card">
        {filtered.map((t: any) => (
          <div className="task-row" key={t.id}>
            <button
              disabled={
                t.status === "completed" || !can(currentUser(), "task.write")
              }
              className={
                "task-check " + (t.status === "completed" ? "done" : "")
              }
              aria-label={"Complete " + t.title}
              onClick={async () => {
                try {
                  await api("/tasks/" + t.id + "/complete", {
                    method: "PATCH",
                  });
                  await reload();
                } catch (e: any) {
                  setError(e.message);
                }
              }}
            >
              {t.status === "completed" && <Check size={14} />}
            </button>
            <div className="task-content">
              <b className={t.status === "completed" ? "task-done" : ""}>
                {t.title}
              </b>
              <small>
                {t.lead_name || "Workspace task"} · {t.assignee_name}
              </small>
            </div>
            <Badge
              tone={
                t.status === "open" &&
                t.due_at &&
                new Date(t.due_at) < new Date()
                  ? "amber"
                  : "neutral"
              }
            >
              {date(t.due_at)}
            </Badge>
          </div>
        ))}
        {!filtered.length && (
          <Empty
            title={
              tab === "completed"
                ? "No completed tasks yet"
                : "You’re all caught up"
            }
            text="Create a task to plan your next follow-up."
          />
        )}
      </div>
      {show && (
        <Modal title="New task" onClose={() => setShow(false)}>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api("/tasks", {
                  method: "POST",
                  body: JSON.stringify({
                    ...f,
                    dueAt: f.dueAt ? new Date(f.dueAt).toISOString() : null,
                  }),
                });
                setShow(false);
                setF({ ...f, title: "", leadId: "", dueAt: "" });
                await reload();
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Notice message={error} />
            <Field label="What needs to happen?">
              <input
                required
                className="input"
                value={f.title}
                onChange={(e) => setF({ ...f, title: e.target.value })}
              />
            </Field>
            <Field label="Related lead">
              <select
                className="input"
                value={f.leadId}
                onChange={(e) => setF({ ...f, leadId: e.target.value })}
              >
                <option value="">No linked lead</option>
                {leads.map((l: any) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="Assigned to">
                <select
                  required
                  className="input"
                  value={f.assigneeId}
                  onChange={(e) => setF({ ...f, assigneeId: e.target.value })}
                >
                  {users
                    .filter((x: any) => x.active)
                    .map((x: any) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Due date and time">
                <input
                  className="input"
                  type="datetime-local"
                  value={f.dueAt}
                  onChange={(e) => setF({ ...f, dueAt: e.target.value })}
                />
              </Field>
            </div>
            <button className="btn" disabled={busy}>
              {busy ? "Creating…" : "Create task"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
