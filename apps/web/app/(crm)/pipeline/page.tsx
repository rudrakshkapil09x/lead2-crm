"use client";
import Link from "next/link";
import { useState } from "react";
import { Plus, Columns3 } from "lucide-react";
import { api, currentUser, can, money, shortMoney } from "../../../lib/api";
import {
  PageHead,
  Loading,
  Notice,
  Badge,
  Avatar,
  Empty,
  useResource,
} from "../../../components/UI";
export default function Pipeline() {
  const { data, error, setError, reload } = useResource(() =>
      Promise.all([api("/pipelines"), api("/leads")]),
    ),
    [pipeId, setPipe] = useState(""),
    [drag, setDrag] = useState("");
  if (!data) return error ? <Notice message={error} /> : <Loading />;
  const [pipes, allLeads] = data,
    p = pipes.find((x: any) => x.id === pipeId) || pipes[0];
  return (
    <>
      <PageHead
        eyebrow="SEE THE NEXT OPPORTUNITY"
        title="Sales pipeline"
        description="Move opportunities forward, one meaningful conversation at a time."
        actions={
          <Link className="btn" href="/leads?new=1">
            <Plus size={14} />
            New lead
          </Link>
        }
      />
      <Notice message={error} onClose={() => setError("")} />
      <div className="toolbar">
        <div className="row">
          <Columns3 size={16} />
          <select
            aria-label="Sales pipeline"
            className="input"
            style={{ width: 220 }}
            value={p?.id || ""}
            onChange={(e) => setPipe(e.target.value)}
          >
            {pipes.map((x: any) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
        <span className="subtle">
          Drag a card to move stages, or open it to choose a stage.
        </span>
      </div>
      {p ? (
        <div className="board">
          {p.stages.map((s: any) => {
            const leads = allLeads.filter((l: any) => l.stage_id === s.id);
            return (
              <section
                key={s.id}
                className="column"
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => {
                  e.preventDefault();
                  if (!drag) return;
                  try {
                    await api("/leads/" + drag, {
                      method: "PATCH",
                      body: JSON.stringify({ stageId: s.id }),
                    });
                    await reload();
                  } catch (e: any) {
                    setError(e.message);
                  } finally {
                    setDrag("");
                  }
                }}
              >
                <div className="column-head">
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 7,
                      background: s.color,
                    }}
                  />
                  <b>{s.name}</b>
                  <Badge>{leads.length}</Badge>
                  <small>{s.probability}%</small>
                </div>
                <div className="column-value">
                  {shortMoney(
                    leads.reduce((n: number, l: any) => n + Number(l.value), 0),
                  )}{" "}
                  total value
                </div>
                {leads.map((l: any) => (
                  <article
                    key={l.id}
                    className="lead-card"
                    draggable={can(currentUser(), "lead.write")}
                    onDragStart={(e) => {
                      setDrag(l.id);
                      e.dataTransfer.setData("text/plain", l.id);
                    }}
                    onDragEnd={() => setDrag("")}
                  >
                    <Link href={"/leads/" + l.id}>
                      <h3>{l.name}</h3>
                      <p>{l.company || "Individual"}</p>
                      <strong>{money(l.value)}</strong>
                    </Link>
                    <footer>
                      <div className="person-cell">
                        <Avatar name={l.owner_name || "Unassigned"} small />
                        <span>{l.owner_name?.split(" ")[0]}</span>
                      </div>
                      <Badge tone={l.stage_age_days > 14 ? "amber" : "neutral"}>
                        {l.stage_age_days}d in stage
                      </Badge>
                    </footer>
                  </article>
                ))}
                {!leads.length && (
                  <div className="empty" style={{ padding: 24, fontSize: 11 }}>
                    No opportunities
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <Empty title="Create your first pipeline" />
      )}
      <p className="subtle">
        Showing the 500 most recently updated accessible leads. Search the Leads
        page for older records.
      </p>
    </>
  );
}
