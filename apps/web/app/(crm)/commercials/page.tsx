"use client";
import { useState } from "react";
import {
  Plus,
  Pencil,
  FileText,
  BookOpen,
  Upload,
  Trash2,
  Download,
} from "lucide-react";
import { api, money, currentUser, can } from "../../../lib/api";
import {
  PageHead,
  Notice,
  Loading,
  Empty,
  Badge,
  Modal,
  Field,
  CURRENCIES,
  useResource,
} from "../../../components/UI";
const defaultHtml =
  "<h1>{{proposal_title}}</h1>\n<p>Prepared for {{client_name}} at {{company_name}}</p>\n<h2>Your requirements</h2><p>{{scope}}</p>\n{{commercial_table}}\n<h2>Delivery</h2><p>{{timeline}}</p>\n<h2>Terms</h2><p>{{terms}}</p>\n<p>Valid until {{valid_until}}</p>";
export default function Commercials() {
  const { data, error, setError, reload } = useResource(() =>
      Promise.all([api("/proposals/commercials"), api("/proposals/templates")]),
    ),
    [tab, setTab] = useState("commercials"),
    [edit, setEdit] = useState<any>(null),
    [template, setTemplate] = useState<any>(null),
    [f, setF] = useState<any>({}),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  if (!data) return error ? <Notice message={error} /> : <Loading />;
  const [catalogs, templates] = data;
  async function save(path: string, close: () => void) {
    setBusy(true);
    setError("");
    try {
      await api(path, {
        method: edit?.id || template?.id ? "PATCH" : "POST",
        body: JSON.stringify(f),
      });
      close();
      setNotice(
        "Saved. Existing proposals retain their original pricing and template.",
      );
      await reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function openCatalog(c?: any) {
    setEdit(c || {});
    setF(
      c
        ? { ...c, taxPct: c.tax_pct }
        : {
            name: "",
            currency: currentUser()?.currency || "INR",
            taxPct: 0,
            items: [{ description: "", unit: "unit", unitPrice: 0 }],
            terms: "Payment due within 30 days.",
            active: true,
          },
    );
  }
  function openTemplate(t?: any) {
    setTemplate(t || {});
    setF(
      t
        ? { ...t, bodyHtml: t.body_html }
        : {
            name: "",
            bodyHtml: defaultHtml,
            questions: [
              {
                key: "scope",
                label: "What does the customer need?",
                required: true,
              },
              {
                key: "timeline",
                label: "What is the delivery timeline?",
                required: true,
              },
            ],
            active: true,
          },
    );
  }
  return (
    <>
      <PageHead
        eyebrow="READY FOR EVERY CONVERSATION"
        title="Commercials & templates"
        description="Build your price books and standard proposals once. Put them to work across the team."
        actions={
          <button
            className="btn"
            onClick={() =>
              tab === "commercials" ? openCatalog() : openTemplate()
            }
          >
            <Plus size={14} />
            {tab === "commercials" ? "New commercial" : "New template"}
          </button>
        }
      />
      <Notice message={error} onClose={() => setError("")} />
      <Notice message={notice} success onClose={() => setNotice("")} />
      <div className="tabs">
        <button
          className={tab === "commercials" ? "active" : ""}
          onClick={() => setTab("commercials")}
        >
          Commercial catalogs
        </button>
        <button
          className={tab === "templates" ? "active" : ""}
          onClick={() => setTab("templates")}
        >
          Proposal templates
        </button>
      </div>
      {tab === "commercials" ? (
        <div className="cards-grid">
          {catalogs.map((c: any) => (
            <div className="card catalog-card" key={c.id}>
              <div className="row spaced">
                <span className="workspace-icon">
                  <BookOpen size={18} />
                </span>
                <Badge tone={c.active ? "green" : "neutral"}>
                  {c.active ? "Active" : "Archived"} · v{c.version}
                </Badge>
              </div>
              <h2>{c.name}</h2>
              <div>
                {c.items.slice(0, 4).map((x: any) => (
                  <div className="stat-line" key={x.id}>
                    <span>{x.description}</span>
                    <b>{money(x.unitPrice, c.currency)}</b>
                  </div>
                ))}
                {c.items.length > 4 && (
                  <p className="subtle">+ {c.items.length - 4} more items</p>
                )}
              </div>
              <footer>
                <span className="subtle">
                  {c.currency} · {c.tax_pct}% tax
                </span>
                <button
                  className="btn ghost small"
                  onClick={() => openCatalog(c)}
                >
                  <Pencil size={12} />
                  Edit
                </button>
              </footer>
            </div>
          ))}
          {!catalogs.length && (
            <div className="card">
              <Empty
                title="Your first commercial catalog"
                text="Add products, services, prices, tax and terms for your sales team."
                action={
                  <button className="btn" onClick={() => openCatalog()}>
                    Create commercial
                  </button>
                }
              />
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="info-box" style={{ marginBottom: 22 }}>
            Upload your standard proposal as DOCX, HTML, TXT or Markdown.
            Include <code>{"{{commercial_table}}"}</code> for pricing and
            placeholders for your questions. Word content and tables are
            imported; complex page layouts and embedded images are not
            preserved.{" "}
            <a
              className="text-link"
              href="/sample-proposal-template.html"
              download
            >
              Download sample format →
            </a>
          </div>
          <div className="cards-grid">
            {templates.map((t: any) => (
              <div className="card catalog-card" key={t.id}>
                <div className="row spaced">
                  <span className="workspace-icon">
                    <FileText size={18} />
                  </span>
                  <Badge tone={t.active ? "green" : "neutral"}>
                    {t.active ? "Active" : "Archived"} · v{t.version}
                  </Badge>
                </div>
                <h2>{t.name}</h2>
                <p className="muted">
                  {t.questions.length} guided questions ·{" "}
                  {t.source_filename || "Created in Lead2"}
                </p>
                <div className="row">
                  {t.questions.map((q: any) => (
                    <Badge key={q.key}>{q.key}</Badge>
                  ))}
                </div>
                <footer>
                  <span className="subtle">Client-owned format</span>
                  <button
                    className="btn ghost small"
                    onClick={() => openTemplate(t)}
                  >
                    <Pencil size={12} />
                    Edit template
                  </button>
                </footer>
              </div>
            ))}
          </div>
        </>
      )}
      {edit && (
        <Modal
          title={edit.id ? "Edit commercial" : "New commercial"}
          wide
          onClose={() => setEdit(null)}
        >
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void save(
                "/proposals/commercials" + (edit.id ? "/" + edit.id : ""),
                () => setEdit(null),
              );
            }}
          >
            <Notice message={error} />
            <Field label="Commercial name">
              <input
                className="input"
                required
                placeholder="e.g. Enterprise services · India"
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
            </Field>
            <div className="form-grid">
              <Field label="Currency">
                <select
                  className="input"
                  value={f.currency}
                  onChange={(e) => setF({ ...f, currency: e.target.value })}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Tax (%)">
                <input
                  required
                  className="input"
                  type="number"
                  step=".01"
                  min="0"
                  max="100"
                  value={f.taxPct}
                  onChange={(e) => setF({ ...f, taxPct: e.target.value })}
                />
              </Field>
            </div>
            <h3>Products & services</h3>
            {f.items.map((item: any, i: number) => (
              <div className="item-row" key={i}>
                <Field label="Description">
                  <input
                    required
                    className="input"
                    value={item.description}
                    onChange={(e) =>
                      setF({
                        ...f,
                        items: f.items.map((x: any, j: number) =>
                          j === i ? { ...x, description: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </Field>
                <Field label="Unit">
                  <input
                    className="input"
                    value={item.unit}
                    onChange={(e) =>
                      setF({
                        ...f,
                        items: f.items.map((x: any, j: number) =>
                          j === i ? { ...x, unit: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </Field>
                <Field label="Unit price">
                  <input
                    required
                    className="input"
                    type="number"
                    min="0"
                    step=".01"
                    value={item.unitPrice}
                    onChange={(e) =>
                      setF({
                        ...f,
                        items: f.items.map((x: any, j: number) =>
                          j === i ? { ...x, unitPrice: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </Field>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={"Remove item " + (i + 1)}
                  disabled={f.items.length === 1}
                  onClick={() =>
                    setF({
                      ...f,
                      items: f.items.filter((_: any, j: number) => i !== j),
                    })
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn ghost"
              onClick={() =>
                setF({
                  ...f,
                  items: [
                    ...f.items,
                    { description: "", unit: "unit", unitPrice: 0 },
                  ],
                })
              }
            >
              <Plus size={13} />
              Add item
            </button>
            <Field label="Standard payment and delivery terms">
              <textarea
                className="input"
                value={f.terms}
                onChange={(e) => setF({ ...f, terms: e.target.value })}
              />
            </Field>
            <label className="row">
              <input
                type="checkbox"
                checked={f.active}
                onChange={(e) => setF({ ...f, active: e.target.checked })}
              />
              Active for new proposals
            </label>
            <div className="form-actions">
              <button className="btn" disabled={busy}>
                {busy ? "Saving…" : "Save commercial"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {template && (
        <Modal
          title={
            template.id ? "Edit proposal template" : "New proposal template"
          }
          wide
          onClose={() => setTemplate(null)}
        >
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void save(
                "/proposals/templates" + (template.id ? "/" + template.id : ""),
                () => setTemplate(null),
              );
            }}
          >
            <Notice message={error} />
            <Field label="Template name">
              <input
                required
                className="input"
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
            </Field>
            <Field
              label="Upload your standard format"
              hint="DOCX, HTML, TXT, Markdown · Maximum 2 MB"
            >
              <input
                className="input"
                type="file"
                accept=".docx,.html,.htm,.txt,.md"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) {
                    setError("Maximum file size is 2 MB");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () =>
                    setF({
                      ...f,
                      filename: file.name,
                      fileBase64: String(reader.result).split(",")[1],
                    });
                  reader.onerror = () => setError("Could not read file");
                  reader.readAsDataURL(file);
                }}
              />
            </Field>
            {f.fileBase64 ? (
              <div className="info-box row spaced">
                <span>{f.filename} is ready to upload</span>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() =>
                    setF({ ...f, fileBase64: undefined, filename: undefined })
                  }
                >
                  Use editor instead
                </button>
              </div>
            ) : (
              <Field
                label="Template content (HTML)"
                hint="Required: {{commercial_table}}. Other fields: proposal_title, client_name, company_name, terms, valid_until, seller_name, proposal_number."
              >
                <textarea
                  required
                  className="input code"
                  style={{ minHeight: 200 }}
                  value={f.bodyHtml}
                  onChange={(e) => setF({ ...f, bodyHtml: e.target.value })}
                />
              </Field>
            )}
            <h3>Questions asked during proposal generation</h3>
            <p className="subtle">
              Use each question’s key as a placeholder, such as {"{{scope}}"},
              in your uploaded format or editor.
            </p>
            {f.questions.map((q: any, i: number) => (
              <div className="question-row" key={i}>
                <input
                  className="input"
                  aria-label={"Question " + (i + 1) + " key"}
                  placeholder="key"
                  required
                  value={q.key}
                  onChange={(e) =>
                    setF({
                      ...f,
                      questions: f.questions.map((x: any, j: number) =>
                        j === i ? { ...x, key: e.target.value } : x,
                      ),
                    })
                  }
                />
                <input
                  className="input"
                  aria-label={"Question " + (i + 1) + " label"}
                  placeholder="Question asked to users"
                  required
                  value={q.label}
                  onChange={(e) =>
                    setF({
                      ...f,
                      questions: f.questions.map((x: any, j: number) =>
                        j === i ? { ...x, label: e.target.value } : x,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Remove question"
                  onClick={() =>
                    setF({
                      ...f,
                      questions: f.questions.filter(
                        (_: any, j: number) => j !== i,
                      ),
                    })
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={f.questions.length >= 12}
              className="btn ghost"
              onClick={() =>
                setF({
                  ...f,
                  questions: [
                    ...f.questions,
                    { key: "", label: "", required: true },
                  ],
                })
              }
            >
              <Plus size={13} />
              Add question
            </button>
            <label className="row">
              <input
                type="checkbox"
                checked={f.active}
                onChange={(e) => setF({ ...f, active: e.target.checked })}
              />
              Available for new proposals
            </label>
            <div className="form-actions">
              <button className="btn" disabled={busy}>
                {busy ? "Saving…" : "Save template"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
