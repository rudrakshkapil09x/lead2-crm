"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import {
  Plus,
  Upload,
  Download,
  Search,
  ArrowRightLeft,
  UsersRound,
} from "lucide-react";
import { api, currentUser, can, money, date } from "../../../lib/api";
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
import LeadForm from "../../../components/LeadForm";
export default function Leads() {
  const [q, setQ] = useState(""),
    [stage, setStage] = useState(""),
    [show, setShow] = useState(false),
    [notice, setNotice] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [transfer, setTransfer] = useState(false),
    [owner, setOwner] = useState(""),
    [importing, setImporting] = useState(false),
    [offset, setOffset] = useState(0);
  const file = useRef<HTMLInputElement>(null);
  const { data, error, setError, reload } = useResource(() =>
    Promise.all([
      api(
        "/leads?limit=50&offset=" +
          offset +
          "&q=" +
          encodeURIComponent(q) +
          (stage ? "&stageId=" + stage : ""),
      ),
      api("/pipelines"),
      api("/users"),
    ]),
  );
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setShow(params.get("new") === "1");
    if (params.get("q")) {
      setQ(params.get("q")!);
      api("/leads?q=" + encodeURIComponent(params.get("q")!))
        .then((l) => setSearchResult(l))
        .catch((e) => setError(e.message));
    }
  }, []);
  const [searchResult, setSearchResult] = useState<any[] | null>(null);
  useEffect(() => {
    if (data) void search(offset);
  }, [offset]);
  async function search(start = 0) {
    try {
      setSearchResult(
        await api(
          "/leads?limit=50&offset=" +
            start +
            "&q=" +
            encodeURIComponent(q) +
            (stage ? "&stageId=" + stage : ""),
        ),
      );
      setSelected([]);
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function refresh() {
    setSearchResult(null);
    await reload();
  }
  async function csv(fl: File) {
    if (fl.size > 2 * 1024 * 1024) {
      setError("Import CSV files under 2 MB");
      return;
    }
    setImporting(true);
    setError("");
    try {
      const p = Papa.parse<any>(await fl.text(), {
        header: true,
        skipEmptyLines: true,
      });
      if (p.errors.length) throw new Error(p.errors[0].message);
      if (p.data.length > 1000)
        throw new Error("Import up to 1,000 rows at a time");
      const result = await api("/leads/import/rows", {
        method: "POST",
        body: JSON.stringify({
          rows: p.data.map((r: any) => ({
            name: r.name || r.Name || r["Lead Name"],
            company: r.company || r.Company,
            email: r.email || r.Email,
            phone: r.phone || r.Phone,
            value: r.value || r.Value || 0,
            source: r.source || r.Source || "CSV",
          })),
        }),
      });
      setNotice(
        `${result.created} created · ${result.duplicates} duplicates skipped · ${result.errors.length} errors${
          result.errors.length
            ? ". " +
              result.errors
                .slice(0, 5)
                .map((e: any) => `Row ${e.row}: ${e.error}`)
                .join("; ")
            : ""
        }`,
      );
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImporting(false);
      if (file.current) file.current.value = "";
    }
  }
  function exportCsv() {
    const rows = (searchResult || data?.[0] || []).map((l: any) => ({
      name: l.name,
      company: l.company,
      email: l.email,
      phone: l.phone,
      value: l.value,
      source: l.source,
      owner: l.owner_name,
      stage: l.stage_name,
    }));
    const content = Papa.unparse(rows, { escapeFormulae: true });
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "lead2-leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  if (!data && !error) return <Loading />;
  const [base = [], pipes = [], users = []] = data || [],
    leads = searchResult || base;
  return (
    <>
      <PageHead
        eyebrow="RELATIONSHIPS START HERE"
        title="Leads"
        description="A place for every contact. A next step for every opportunity."
        actions={
          <>
            <input
              ref={file}
              type="file"
              hidden
              accept=".csv"
              onChange={(e) => e.target.files?.[0] && csv(e.target.files[0])}
            />
            {can(currentUser(), "lead.write") && (
              <>
                <button
                  className="btn ghost"
                  disabled={importing}
                  onClick={() => file.current?.click()}
                >
                  <Upload size={14} />
                  {importing ? "Importing…" : "Import CSV"}
                </button>
                <button className="btn" onClick={() => setShow(true)}>
                  <Plus size={14} />
                  New lead
                </button>
              </>
            )}
          </>
        }
      />
      <Notice message={error} onClose={() => setError("")} />
      <Notice message={notice} success onClose={() => setNotice("")} />
      <div className="card">
        <div className="toolbar">
          <form
            className="search-box"
            onSubmit={(e) => {
              e.preventDefault();
              setOffset(0);
              void search(0);
            }}
          >
            <Search size={16} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search leads"
              placeholder="Search leads, companies or sources…"
            />
            <button className="icon-btn" aria-label="Run search">
              <ArrowRightLeft size={13} />
            </button>
          </form>
          <div className="row">
            <select
              aria-label="Filter by stage"
              className="input"
              style={{ width: 160 }}
              value={stage}
              onChange={(e) => setStage(e.target.value)}
            >
              <option value="">All stages</option>
              {pipes
                .flatMap((p: any) => p.stages)
                .map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
            <button
              className="btn ghost"
              onClick={() => {
                setOffset(0);
                void search(0);
              }}
            >
              Apply
            </button>
            <button className="btn ghost" onClick={exportCsv}>
              <Download size={13} />
              Export page
            </button>
          </div>
        </div>
        {selected.length > 0 && (
          <div className="info-box row" style={{ marginBottom: 15 }}>
            {selected.length} selected
            <button className="btn small" onClick={() => setTransfer(true)}>
              Reassign owner
            </button>
            <button className="btn ghost small" onClick={() => setSelected([])}>
              Clear selection
            </button>
          </div>
        )}
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                {can(currentUser(), "lead.assign") && (
                  <th>
                    <input
                      aria-label="Select all visible leads"
                      type="checkbox"
                      checked={
                        !!leads.length && selected.length === leads.length
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked ? leads.map((x: any) => x.id) : [],
                        )
                      }
                    />
                  </th>
                )}
                <th>Lead / company</th>
                <th>Stage</th>
                <th>Deal value</th>
                <th>Tags & Score</th>
                <th>Owner</th>
                <th>Stage age</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l: any) => (
                <tr key={l.id}>
                  {can(currentUser(), "lead.assign") && (
                    <td>
                      <input
                        aria-label={"Select " + l.name}
                        type="checkbox"
                        checked={selected.includes(l.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, l.id]
                              : selected.filter((x) => x !== l.id),
                          )
                        }
                      />
                    </td>
                  )}
                  <td>
                    <Link className="person-cell" href={"/leads/" + l.id}>
                      <Avatar name={l.name} small />
                      <div>
                        <b>{l.name}</b>
                        <small>
                          {l.company || l.email || l.phone || "No company"}
                        </small>
                      </div>
                    </Link>
                  </td>
                  <td>
                    <Badge tone={l.status}>
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
                    <b>{money(l.value)}</b>
                  </td>
                  <td>
                    <div className="row" style={{ flexWrap: "wrap", gap: 4 }}>
                      {l.score > 0 && <Badge tone="neutral">★ {l.score}</Badge>}
                      {l.tag_names?.map((t: string) => (
                        <span key={t} style={{ background: "#e2e8f0", padding: "2px 6px", borderRadius: 12, fontSize: 11, fontWeight: 500 }}>
                          {t}
                        </span>
                      ))}
                    </div>
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
        {!leads.length && (
          <Empty
            title={
              q || stage ? "No matching leads" : "Make your first connection"
            }
            text="Add a lead or import your contact list to get started."
          />
        )}
        <div className="page-footer">
          <span>
            {leads.length ? `${offset + 1}–${offset + leads.length}` : "0"}{" "}
            records · Access follows your role
          </span>
          <div className="row">
            <button
              className="btn ghost small"
              disabled={!offset}
              onClick={() => setOffset(Math.max(0, offset - 50))}
            >
              Previous
            </button>
            <button
              className="btn ghost small"
              disabled={leads.length < 50}
              onClick={() => setOffset(offset + 50)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
      {show && (
        <Modal title="New lead" onClose={() => setShow(false)}>
          <LeadForm
            users={users}
            onClose={() => setShow(false)}
            onSaved={() => {
              setShow(false);
              setNotice("Lead created");
              void refresh();
            }}
          />
        </Modal>
      )}
      {transfer && (
        <Modal
          title="Reassign selected leads"
          onClose={() => setTransfer(false)}
        >
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("/leads/assign", {
                  method: "POST",
                  body: JSON.stringify({ leadIds: selected, ownerId: owner }),
                });
                setTransfer(false);
                setSelected([]);
                setNotice("Ownership updated");
                await refresh();
              } catch (e: any) {
                setError(e.message);
              }
            }}
          >
            <p className="muted">
              Selected leads and their linked proposal ownership will move to
              this user.
            </p>
            <Field label="New owner">
              <select
                required
                className="input"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              >
                <option value="">Choose a user</option>
                {users
                  .filter((x: any) => x.active)
                  .map((x: any) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
            </Field>
            <button className="btn">Reassign {selected.length} leads</button>
          </form>
        </Modal>
      )}
    </>
  );
}
