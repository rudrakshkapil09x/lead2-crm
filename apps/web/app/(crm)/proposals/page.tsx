"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Plus,
  FileText,
  ArrowRight,
  ArrowLeft,
  Download,
  ExternalLink,
  Check,
  ChevronRight,
} from "lucide-react";
import {
  api,
  API,
  currentUser,
  can,
  money,
  date,
  label,
  downloadDocument,
} from "../../../lib/api";
import {
  PageHead,
  Notice,
  Loading,
  Empty,
  Badge,
  Modal,
  Field,
  useResource,
} from "../../../components/UI";
export default function Proposals() {
  const { data, error, setError, reload } = useResource(() =>
      Promise.all([
        api("/proposals"),
        api("/leads"),
        api("/proposals/commercials"),
        api("/proposals/templates"),
      ]),
    ),
    [show, setShow] = useState(false),
    [step, setStep] = useState(0),
    [f, setF] = useState<any>({
      title: "Commercial proposal",
      leadId: "",
      commercialId: "",
      templateId: "",
      items: [],
      answers: {},
      discountPct: 0,
      validUntil: new Date(Date.now() + 30 * 86400000)
        .toISOString()
        .slice(0, 10),
    }),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<any>(null),
    [notice, setNotice] = useState(""),
    [review, setReview] = useState<any>(null),
    [note, setNote] = useState(""),
    [tab, setTab] = useState("all");
  useEffect(() => {
    const lead = new URLSearchParams(location.search).get("lead");
    if (lead) {
      setF((x: any) => ({ ...x, leadId: lead }));
      setShow(true);
    }
  }, []);
  if (!data) return error ? <Notice message={error} /> : <Loading />;
  const [proposals, leads, commercials, templates] = data,
    c = commercials.find((x: any) => x.id === f.commercialId),
    t = templates.find((x: any) => x.id === f.templateId);
  const subtotal = f.items.reduce(
      (n: number, x: any) =>
        n +
        Number(c?.items.find((p: any) => p.id === x.itemId)?.unitPrice || 0) *
          Number(x.qty),
      0,
    ),
    discount = Math.round(subtotal * Number(f.discountPct)) / 100,
    net = subtotal - discount,
    tax = Math.round(net * Number(c?.tax_pct || 0)) / 100,
    total = net + tax;
  async function transition(id: string, status: string) {
    setBusy(true);
    setError("");
    try {
      await api("/proposals/" + id + "/status", {
        method: "PATCH",
        body: JSON.stringify({ status, note }),
      });
      setReview(null);
      setNotice("Proposal " + label(status).toLowerCase());
      await reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function advance(e: any) {
    e.preventDefault();
    setError("");
    if (step === 0) {
      if (!c || !t) {
        setError("Choose an active commercial and template");
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!f.items.length) {
        setError("Select at least one product or service");
        return;
      }
      setStep(2);
      return;
    }
    setBusy(true);
    try {
      const p = await api("/proposals", {
        method: "POST",
        body: JSON.stringify(f),
      });
      setShow(false);
      setNotice(
        p.status === "approval_required"
          ? "Proposal generated and queued for approval."
          : "Proposal draft generated.",
      );
      await reload();
      setPreview(p);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const filtered = proposals.filter(
    (p: any) => tab === "all" || p.status === tab,
  );
  return (
    <>
      <PageHead
        eyebrow="FROM CONVERSATION TO COMMITMENT"
        title="Proposals"
        description="Thoughtful proposals, consistent commercials, and clear approval paths."
        actions={
          can(currentUser(), "proposal.write") && (
            <button
              className="btn"
              onClick={() => {
                setStep(0);
                setError("");
                setShow(true);
              }}
            >
              <Plus size={14} />
              Create proposal
            </button>
          )
        }
      />
      <Notice message={error} onClose={() => setError("")} />
      <Notice message={notice} success onClose={() => setNotice("")} />
      <div className="tabs">
        {["all", "draft", "approval_required", "sent", "accepted"].map((x) => (
          <button
            key={x}
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
          >
            {x === "all"
              ? "All proposals"
              : x === "approval_required"
                ? "Awaiting approval"
                : label(x)}
          </button>
        ))}
      </div>
      <div className="card">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Proposal</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Valid until</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <button
                      className="icon-btn"
                      style={{ textAlign: "left", display: "block" }}
                      onClick={() => setPreview(p)}
                    >
                      <b>{p.title}</b>
                      <small>
                        {date(p.created_at)} ·{" "}
                        {p.creator_name || "Lead2 Engineer"}
                      </small>
                    </button>
                  </td>
                  <td>{p.lead_name}</td>
                  <td>
                    <b>{money(p.total, p.currency)}</b>
                  </td>
                  <td>
                    <Badge tone={p.status}>{label(p.status)}</Badge>
                  </td>
                  <td>{date(p.valid_until)}</td>
                  <td>
                    <div className="row">
                      <button
                        className="btn ghost small"
                        onClick={() => setPreview(p)}
                      >
                        View
                      </button>
                      {p.status === "approval_required" && p.canApprove && (
                        <button
                          className="btn small"
                          onClick={() => {
                            setReview(p);
                            setNote("");
                          }}
                        >
                          Review
                        </button>
                      )}
                      {["draft", "approved"].includes(p.status) &&
                        can(currentUser(), "proposal.write") && (
                          <button
                            className="btn ghost small"
                            disabled={busy}
                            onClick={() => transition(p.id, "sent")}
                          >
                            Mark sent
                          </button>
                        )}
                      {p.status === "sent" &&
                        can(currentUser(), "proposal.write") && (
                          <>
                            <button
                              className="btn ghost small"
                              disabled={busy}
                              onClick={() => transition(p.id, "accepted")}
                            >
                              Mark accepted
                            </button>
                            <button
                              className="btn ghost small"
                              disabled={busy}
                              onClick={() => transition(p.id, "declined")}
                            >
                              Declined
                            </button>
                          </>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <Empty
            title="Your next proposal starts here"
            text="Choose a customer, a commercial catalog and a template. Answer a few questions, then generate."
            action={
              can(currentUser(), "proposal.write") && (
                <button className="btn" onClick={() => setShow(true)}>
                  Create proposal
                </button>
              )
            }
          />
        )}
      </div>
      <p className="subtle" style={{ marginTop: 15 }}>
        “Mark sent” records an external handoff. Lead2 does not send an email
        from this screen.
      </p>
      {show && (
        <Modal title="Create a proposal" wide onClose={() => setShow(false)}>
          <div className="stepper">
            {[
              "Choose your starting point",
              "Make it relevant",
              "Review & generate",
            ].map((x, i) => (
              <div className={"step " + (i === step ? "active" : "")} key={x}>
                <b>{i + 1}</b>
                <span>{x}</span>
              </div>
            ))}
          </div>
          <form className="form" onSubmit={advance}>
            <Notice message={error} />
            {!commercials.some((x: any) => x.active) ||
            !templates.some((x: any) => x.active) ? (
              <div className="info-box">
                Your Client Super Admin needs to add an active commercial
                catalog and proposal template first.{" "}
                {can(currentUser(), "commercial.manage") && (
                  <Link className="text-link" href="/commercials">
                    Set up commercials →
                  </Link>
                )}
              </div>
            ) : (
              <>
                {step === 0 && (
                  <>
                    <Field label="Who is the proposal for?">
                      <select
                        required
                        className="input"
                        value={f.leadId}
                        onChange={(e) => setF({ ...f, leadId: e.target.value })}
                      >
                        <option value="">Select a lead</option>
                        {leads.map((l: any) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                            {l.company ? " · " + l.company : ""}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Which commercial catalog applies?">
                      <select
                        required
                        className="input"
                        value={f.commercialId}
                        onChange={(e) => {
                          const next = commercials.find(
                            (x: any) => x.id === e.target.value,
                          );
                          setF({
                            ...f,
                            commercialId: e.target.value,
                            items:
                              next?.items.map((x: any) => ({
                                itemId: x.id,
                                qty: 1,
                              })) || [],
                          });
                        }}
                      >
                        <option value="">Select commercial</option>
                        {commercials
                          .filter((x: any) => x.active)
                          .map((c: any) => (
                            <option key={c.id} value={c.id}>
                              {c.name} · {c.currency}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label="Which standard format should we use?">
                      <select
                        required
                        className="input"
                        value={f.templateId}
                        onChange={(e) =>
                          setF({
                            ...f,
                            templateId: e.target.value,
                            answers: {},
                          })
                        }
                      >
                        <option value="">Select a template</option>
                        {templates
                          .filter((x: any) => x.active)
                          .map((t: any) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                      </select>
                    </Field>
                  </>
                )}
                {step === 1 && (
                  <>
                    <div className="form-grid">
                      <Field label="Proposal title">
                        <input
                          required
                          className="input"
                          value={f.title}
                          onChange={(e) =>
                            setF({ ...f, title: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Valid until">
                        <input
                          required
                          type="date"
                          min={new Date().toISOString().slice(0, 10)}
                          className="input"
                          value={f.validUntil}
                          onChange={(e) =>
                            setF({ ...f, validUntil: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                    {t?.questions.map((q: any) => (
                      <Field key={q.key} label={q.label}>
                        <textarea
                          required={q.required}
                          className="input"
                          value={f.answers[q.key] || ""}
                          onChange={(e) =>
                            setF({
                              ...f,
                              answers: {
                                ...f.answers,
                                [q.key]: e.target.value,
                              },
                            })
                          }
                        />
                      </Field>
                    ))}
                    <h3>Products & quantities</h3>
                    {c?.items.map((x: any) => {
                      const item = f.items.find((i: any) => i.itemId === x.id);
                      return (
                        <div key={x.id} className="row spaced">
                          <label
                            className="row"
                            style={{ flex: 1, fontSize: 12 }}
                          >
                            <input
                              type="checkbox"
                              checked={!!item}
                              onChange={(e) =>
                                setF({
                                  ...f,
                                  items: e.target.checked
                                    ? [...f.items, { itemId: x.id, qty: 1 }]
                                    : f.items.filter(
                                        (i: any) => i.itemId !== x.id,
                                      ),
                                })
                              }
                            />
                            {x.description}
                            <span className="subtle">
                              {money(x.unitPrice, c.currency)} / {x.unit}
                            </span>
                          </label>
                          {item && (
                            <input
                              aria-label={"Quantity for " + x.description}
                              className="input"
                              style={{ width: 90 }}
                              type="number"
                              required
                              min="0.01"
                              max="100000"
                              step=".01"
                              value={item.qty}
                              onChange={(e) =>
                                setF({
                                  ...f,
                                  items: f.items.map((i: any) =>
                                    i.itemId === x.id
                                      ? { ...i, qty: Number(e.target.value) }
                                      : i,
                                  ),
                                })
                              }
                            />
                          )}
                        </div>
                      );
                    })}
                    <Field
                      label="Requested discount (%)"
                      hint={`Your self-authorized limit is ${currentUser()?.authority?.selfDiscountPct || 0}%. Higher discounts require another authorized reviewer.`}
                    >
                      <input
                        required
                        className="input"
                        type="number"
                        min="0"
                        max="100"
                        step=".01"
                        value={f.discountPct}
                        onChange={(e) =>
                          setF({ ...f, discountPct: e.target.value })
                        }
                      />
                    </Field>
                  </>
                )}
                {step === 2 && (
                  <>
                    <div className="info-box">
                      <b>{f.title}</b>
                      <p>
                        {leads.find((l: any) => l.id === f.leadId)?.name} ·{" "}
                        {c?.name}
                      </p>
                      <p>
                        Template: {t?.name} · Valid until {date(f.validUntil)}
                      </p>
                    </div>
                    <div className="table-scroll">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Product / service</th>
                            <th>Quantity</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {f.items.map((i: any) => {
                            const x = c?.items.find(
                              (p: any) => p.id === i.itemId,
                            );
                            return (
                              <tr key={i.itemId}>
                                <td>{x?.description}</td>
                                <td>{i.qty}</td>
                                <td>
                                  {money(
                                    i.qty * Number(x?.unitPrice),
                                    c?.currency,
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="totals">
                      <div className="stat-line">
                        <span>Subtotal</span>
                        <b>{money(subtotal, c?.currency)}</b>
                      </div>
                      <div className="stat-line">
                        <span>Discount ({f.discountPct}%)</span>
                        <b>−{money(discount, c?.currency)}</b>
                      </div>
                      <div className="stat-line">
                        <span>Tax ({c?.tax_pct}%)</span>
                        <b>{money(tax, c?.currency)}</b>
                      </div>
                      <div className="stat-line">
                        <span>Total estimate</span>
                        <b>{money(total, c?.currency)}</b>
                      </div>
                    </div>
                    {Number(f.discountPct) >
                      Number(currentUser()?.authority?.selfDiscountPct) && (
                      <div className="info-box">
                        This discount requires approval. The proposal will enter
                        the approval queue and cannot be marked as sent until
                        approved.
                      </div>
                    )}
                    <p className="subtle">
                      Final amounts are calculated from the saved commercial
                      catalog. A snapshot preserves this version of your
                      proposal.
                    </p>
                  </>
                )}
                <div className="form-actions">
                  {step > 0 && (
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => setStep(step - 1)}
                    >
                      <ArrowLeft size={13} />
                      Back
                    </button>
                  )}
                  <button className="btn" disabled={busy}>
                    {busy
                      ? "Generating…"
                      : step === 2
                        ? "Generate proposal"
                        : "Continue"}
                    <ArrowRight size={13} />
                  </button>
                </div>
              </>
            )}
          </form>
        </Modal>
      )}
      {preview && (
        <Modal title={preview.title} wide onClose={() => setPreview(null)}>
          <div className="row" style={{ marginBottom: 18 }}>
            <button
              className="btn ghost"
              onClick={() =>
                downloadDocument(preview.id, preview.title).catch((e) =>
                  setError(e.message),
                )
              }
            >
              <Download size={13} />
              Download HTML
            </button>
            <a
              className="btn"
              href={`${API}/proposals/${preview.id}/document`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={13} />
              Open / print PDF
            </a>
          </div>
          <p className="subtle" style={{ marginBottom: 13 }}>
            Open the proposal, then use your browser’s Print → Save as PDF
            option.
          </p>
          <iframe
            title="Proposal document preview"
            className="document-frame"
            sandbox="allow-same-origin"
            src={`${API}/proposals/${preview.id}/document`}
          />
        </Modal>
      )}
      {review && (
        <Modal title="Review proposal" onClose={() => setReview(null)}>
          <Notice message={error} />
          <div className="info-box">
            <b>{review.title}</b>
            <p>
              {money(review.total, review.currency)} · {review.discount_pct}%
              discount
            </p>
          </div>
          <div className="form" style={{ marginTop: 20 }}>
            <Field label="Review note">
              <textarea
                className="input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <div className="form-actions">
              <button
                disabled={busy}
                className="btn danger"
                onClick={() => transition(review.id, "rejected")}
              >
                Reject proposal
              </button>
              <button
                disabled={busy}
                className="btn"
                onClick={() => transition(review.id, "approved")}
              >
                <Check size={13} />
                Approve proposal
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
