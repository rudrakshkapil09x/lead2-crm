"use client";
import Link from "next/link";
import { use, useState } from "react";
import {
  ArrowLeft,
  Mail,
  Phone,
  Pencil,
  Plus,
  FileText,
  Trash2,
  Tag,
} from "lucide-react";
import { api, currentUser, can, money, date } from "../../../../lib/api";
import {
  Notice,
  PageHead,
  Loading,
  Avatar,
  Badge,
  Modal,
  Field,
  useResource,
} from "../../../../components/UI";
import LeadForm from "../../../../components/LeadForm";
export default function LeadDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, error, setError, reload } = useResource(() =>
    Promise.all([api("/leads/" + id), api("/pipelines"), api("/users"), api("/leads/tags")]),
  );
  const [edit, setEdit] = useState(false),
    [body, setBody] = useState(""),
    [type, setType] = useState("note"),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [tagsModal, setTagsModal] = useState(false);
  if (!data) return error ? <Notice message={error} /> : <Loading />;
  const [l, pipes, users, allTags] = data,
    stages = pipes.find((p: any) => p.id === l.pipeline_id)?.stages || [];
  return (
    <>
      <Link href="/leads" className="text-link">
        <ArrowLeft size={12} /> Back to leads
      </Link>
      <div style={{ height: 20 }} />
      <PageHead
        title={l.name}
        description={l.company || "Individual contact"}
        actions={
          <>
            {can(currentUser(), "lead.write") && (
              <button className="btn ghost" onClick={() => setEdit(true)}>
                <Pencil size={13} />
                Edit lead
              </button>
            )}
            {can(currentUser(), "proposal.write") && (
              <Link className="btn" href={"/proposals?lead=" + id}>
                <FileText size={13} />
                Create proposal
              </Link>
            )}
          </>
        }
      />
      <Notice message={error} />
      <div className="split">
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h2>Opportunity details</h2>
              <Badge tone={l.status}>{l.stage_name}</Badge>
            </div>
            <div className="form-grid">
              <Field label="Current stage">
                <select
                  disabled={!can(currentUser(), "lead.write")}
                  className="input"
                  value={l.stage_id}
                  onChange={async (e) => {
                    try {
                      await api("/leads/" + id, {
                        method: "PATCH",
                        body: JSON.stringify({ stageId: e.target.value }),
                      });
                      await reload();
                    } catch (e: any) {
                      setError(e.message);
                    }
                  }}
                >
                  {stages.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div>
                <div className="field-label">Deal value</div>
                <h1 style={{ marginTop: 12 }}>{money(l.value)}</h1>
              </div>
              <div>
                <div className="field-label">Lead Score</div>
                <h1 style={{ marginTop: 12 }}>{l.score}</h1>
              </div>
            </div>
            <div className="divider" />
            <div className="row spaced" style={{ alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div className="subtle">Tags</div>
                <div className="row" style={{ marginTop: 8, flexWrap: "wrap", gap: 4 }}>
                  {l.tags?.map((t: any) => (
                    <span key={t.id} style={{ background: t.color, padding: "2px 8px", borderRadius: 12, fontSize: 12, fontWeight: 500 }}>
                      {t.name}
                    </span>
                  ))}
                  {can(currentUser(), "lead.write") && (
                    <button className="btn ghost" style={{ padding: "0 8px", height: 24, fontSize: 12 }} onClick={() => setTagsModal(true)}>
                      <Tag size={10} style={{ marginRight: 4 }} /> Manage
                    </button>
                  )}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div className="subtle">Owner</div>
                <div className="person-cell" style={{ marginTop: 8 }}>
                  <Avatar name={l.owner_name || "Unassigned"} small />
                  <b>{l.owner_name}</b>
                </div>
              </div>
              <div>
                <div className="subtle">Created</div>
                <p>{date(l.created_at)}</p>
              </div>
              <div>
                <div className="subtle">In current stage</div>
                <p>{l.stage_age_days} days</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <h2>Activity timeline</h2>
              <Badge>{l.activities.length} activities</Badge>
            </div>
            {can(currentUser(), "lead.write") && (
              <form
                className="form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  try {
                    await api("/leads/" + id + "/activities", {
                      method: "POST",
                      body: JSON.stringify({ type, body }),
                    });
                    setBody("");
                    await reload();
                  } catch (e: any) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <textarea
                  required
                  className="input"
                  aria-label="Activity details"
                  placeholder="Capture a conversation, decision or next step…"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                <div className="row spaced">
                  <select
                    aria-label="Activity type"
                    className="input"
                    style={{ width: 140 }}
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    {["note", "call", "email", "meeting"].map((x) => (
                      <option key={x} value={x}>
                        {x[0].toUpperCase() + x.slice(1)}
                      </option>
                    ))}
                  </select>
                  <button className="btn" disabled={busy}>
                    <Plus size={13} />
                    Log activity
                  </button>
                </div>
              </form>
            )}
            {l.activities.map((a: any) => (
              <div className="activity" key={a.id}>
                <Avatar name={a.user_name || "Lead2"} small />
                <div>
                  <p>{a.body}</p>
                  <small>
                    {a.user_name || "Lead2 Engineer"} ·{" "}
                    {a.type.replaceAll("_", " ")} ·{" "}
                    {new Date(a.occurred_at).toLocaleString()}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="stack">
          <div className="card">
            <h2>Contact information</h2>
            <div className="stat-line">
              <span>Email</span>
              <b>{l.email || "—"}</b>
            </div>
            <div className="stat-line">
              <span>Phone</span>
              <b>{l.phone || "—"}</b>
            </div>
            <div className="stat-line">
              <span>Source</span>
              <b>{l.source || "—"}</b>
            </div>
            <div className="stat-line">
              <span>Lead age</span>
              <b>{l.lead_age_days} days</b>
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <h2>Stage history</h2>
            </div>
            {l.stageHistory.map((h: any) => (
              <div className="focus-item" key={h.id}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 8,
                    background: h.color,
                  }}
                />
                <div>
                  <b>{h.stage_name}</b>
                  <small>
                    {date(h.entered_at)} · {h.age_days} days
                  </small>
                </div>
                {!h.exited_at && <Badge tone="green">Current</Badge>}
              </div>
            ))}
          </div>
          {can(currentUser(), "lead.delete") && (
            <button className="btn danger" onClick={() => setConfirm(true)}>
              <Trash2 size={13} />
              Delete lead
            </button>
          )}
        </div>
      </div>
      {edit && (
        <Modal title="Edit lead" onClose={() => setEdit(false)}>
          <LeadForm
            initial={l}
            users={users}
            onClose={() => setEdit(false)}
            onSaved={() => {
              setEdit(false);
              void reload();
            }}
          />
        </Modal>
      )}
      {confirm && (
        <Modal title="Delete this lead?" onClose={() => setConfirm(false)}>
          <p className="muted">
            This permanently deletes the lead and its activities and tasks.
            Leads with proposals are retained for history.
          </p>
          <div className="form-actions">
            <button className="btn ghost" onClick={() => setConfirm(false)}>
              Cancel
            </button>
            <button
              className="btn danger"
              onClick={async () => {
                try {
                  await api("/leads/" + id, { method: "DELETE" });
                  location.href = "/leads";
                } catch (e: any) {
                  setConfirm(false);
                  setError(e.message);
                }
              }}
            >
              Delete lead
            </button>
          </div>
        </Modal>
      )}
      {tagsModal && (
        <Modal title="Manage tags" onClose={() => setTagsModal(false)}>
          <div className="stack">
            {allTags.map((t: any) => {
              const isSelected = l.tagIds?.includes(t.id);
              return (
                <label key={t.id} className="row" style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={async (e) => {
                      const newIds = e.target.checked
                        ? [...(l.tagIds || []), t.id]
                        : (l.tagIds || []).filter((id: string) => id !== t.id);
                      try {
                        await api(`/leads/${id}/tags`, {
                          method: "PUT",
                          body: JSON.stringify({ tagIds: newIds }),
                        });
                        await reload();
                      } catch (err: any) {
                        setError(err.message);
                      }
                    }}
                  />
                  <span style={{ background: t.color, padding: "2px 8px", borderRadius: 12, fontSize: 12, fontWeight: 500, marginLeft: 8 }}>
                    {t.name}
                  </span>
                </label>
              );
            })}
            {allTags.length === 0 && <p className="muted">No tags created in this workspace yet. Create tags in Settings.</p>}
          </div>
          <div className="form-actions" style={{ marginTop: 24 }}>
            <button className="btn" onClick={() => setTagsModal(false)}>Done</button>
          </div>
        </Modal>
      )}
    </>
  );
}
