"use client";
import { useState } from "react";
import { Plus, Pencil, Settings2 } from "lucide-react";
import { api, date, label } from "../../../lib/api";
import {
  PageHead,
  Notice,
  Loading,
  Badge,
  Modal,
  Field,
  useResource,
} from "../../../components/UI";
export default function Admin() {
  const { data, error, setError, reload } = useResource(() =>
      Promise.all([
        api("/pipelines"),
        api("/users/audit"),
        api("/users/workspace"),
      ]),
    ),
    [tab, setTab] = useState("pipelines"),
    [stage, setStage] = useState<any>(null),
    [f, setF] = useState<any>({}),
    [pipeline, setPipeline] = useState(false),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false);
  if (!data) return error ? <Notice message={error} /> : <Loading />;
  const [pipes, audit, workspace] = data;
  return (
    <>
      <PageHead
        eyebrow="BUILT AROUND YOUR BUSINESS"
        title="Workspace settings"
        description="Shape your pipeline and keep a clear record of workspace activity."
      />
      <Notice message={error} onClose={() => setError("")} />
      <div className="tabs">
        <button
          className={tab === "pipelines" ? "active" : ""}
          onClick={() => setTab("pipelines")}
        >
          Pipelines & stages
        </button>
        <button
          className={tab === "audit" ? "active" : ""}
          onClick={() => setTab("audit")}
        >
          Activity audit
        </button>
        <button
          className={tab === "workspace" ? "active" : ""}
          onClick={() => setTab("workspace")}
        >
          Workspace details
        </button>
      </div>
      {tab === "pipelines" && (
        <div className="stack">
          {pipes.map((p: any) => (
            <div className="card" key={p.id}>
              <div className="card-head">
                <div className="row">
                  <h2>{p.name}</h2>
                  {p.is_default && <Badge tone="green">Default</Badge>}
                </div>
                <button
                  className="btn ghost"
                  onClick={() => {
                    setStage({ pipelineId: p.id });
                    setF({
                      name: "",
                      color: "#769784",
                      probability: 10,
                      outcome: "open",
                      requiredFields: [],
                    });
                  }}
                >
                  <Plus size={13} />
                  Add stage
                </button>
              </div>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Stage</th>
                      <th>Probability</th>
                      <th>Outcome</th>
                      <th>Required fields</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.stages.map((s: any) => (
                      <tr key={s.id}>
                        <td>
                          <span
                            style={{
                              background: s.color,
                              display: "inline-block",
                              height: 7,
                              width: 7,
                              borderRadius: 7,
                              marginRight: 9,
                            }}
                          />
                          <b>{s.name}</b>
                        </td>
                        <td>{s.probability}%</td>
                        <td>{label(s.outcome)}</td>
                        <td>{s.required_fields.join(", ") || "None"}</td>
                        <td>
                          <button
                            className="icon-btn"
                            aria-label={"Edit " + s.name}
                            onClick={() => {
                              setStage(s);
                              setF({ ...s, requiredFields: s.required_fields });
                            }}
                          >
                            <Pencil size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <button
            className="btn ghost"
            style={{ justifySelf: "start" }}
            onClick={() => setPipeline(true)}
          >
            <Plus size={13} />
            Create another pipeline
          </button>
        </div>
      )}
      {tab === "audit" && (
        <div className="card">
          <div className="card-head">
            <h2>Recent workspace activity</h2>
            <Badge>Last 200 events</Badge>
          </div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Actor</th>
                  <th>Entity</th>
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
                    <td>{a.actor_name || "Lead2 / system"}</td>
                    <td>{a.entity_type}</td>
                    <td>{new Date(a.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {tab === "workspace" && (
        <div className="card" style={{ maxWidth: 650 }}>
          <h2>{workspace.name}</h2>
          {[
            ["Workspace slug", workspace.slug],
            ["Licensed seats", workspace.seat_limit],
            ["Active users", workspace.active_users],
            ["Base currency", workspace.settings.currency || "INR"],
            [
              "Agreement",
              workspace.agreement?.reference || "Existing agreement",
            ],
          ].map(([k, v]) => (
            <div className="stat-line" key={k}>
              <span>{k}</span>
              <b>{v}</b>
            </div>
          ))}
          <p className="subtle" style={{ marginTop: 20 }}>
            Contact Lead2 Ops for agreement and license changes. Lead values and
            sales forecasts use the workspace’s base currency.
          </p>
        </div>
      )}
      {stage && (
        <Modal
          title={stage.id ? "Edit stage" : "Add pipeline stage"}
          onClose={() => setStage(null)}
        >
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api(
                  stage.id
                    ? "/pipelines/stages/" + stage.id
                    : "/pipelines/" + stage.pipelineId + "/stages",
                  {
                    method: stage.id ? "PATCH" : "POST",
                    body: JSON.stringify(f),
                  },
                );
                setStage(null);
                await reload();
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Notice message={error} />
            <Field label="Stage name">
              <input
                required
                className="input"
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
            </Field>
            <div className="form-grid">
              <Field label="Win probability (%)">
                <input
                  required
                  className="input"
                  type="number"
                  min="0"
                  max="100"
                  value={f.probability}
                  onChange={(e) => setF({ ...f, probability: e.target.value })}
                />
              </Field>
              <Field label="Outcome">
                <select
                  className="input"
                  value={f.outcome}
                  onChange={(e) => setF({ ...f, outcome: e.target.value })}
                >
                  {["open", "won", "lost"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Stage color">
              <input
                type="color"
                value={f.color}
                onChange={(e) => setF({ ...f, color: e.target.value })}
              />
            </Field>
            <Field label="Required before entering this stage">
              <div className="matrix-checks">
                {["phone", "email", "company", "value", "source"].map((x) => (
                  <label key={x}>
                    <input
                      type="checkbox"
                      checked={f.requiredFields.includes(x)}
                      onChange={(e) =>
                        setF({
                          ...f,
                          requiredFields: e.target.checked
                            ? [...f.requiredFields, x]
                            : f.requiredFields.filter((y: string) => y !== x),
                        })
                      }
                    />
                    {label(x)}
                  </label>
                ))}
              </div>
            </Field>
            <button className="btn" disabled={busy}>
              Save stage
            </button>
          </form>
        </Modal>
      )}
      {pipeline && (
        <Modal title="Create pipeline" onClose={() => setPipeline(false)}>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api("/pipelines", {
                  method: "POST",
                  body: JSON.stringify({ name }),
                });
                setPipeline(false);
                setName("");
                await reload();
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Notice message={error} />
            <Field label="Pipeline name">
              <input
                className="input"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <p className="subtle">Add stages after creating the pipeline.</p>
            <button className="btn" disabled={busy}>
              Create pipeline
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
