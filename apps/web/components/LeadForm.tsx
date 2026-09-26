"use client";
import { useState } from "react";
import { api, currentUser, can } from "../lib/api";
import { Field, Notice } from "./UI";
export default function LeadForm({
  users = [],
  initial,
  onSaved,
  onClose,
}: {
  users?: any[];
  initial?: any;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<any>({
      name: initial?.name || "",
      company: initial?.company || "",
      email: initial?.email || "",
      phone: initial?.phone || "",
      value: initial?.value || 0,
      source: initial?.source || "",
      ownerId:
        initial?.owner_id ||
        (currentUser()?.platformAdmin
          ? users.find((x) => x.active)?.id
          : currentUser()?.sub),
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const result = await api(
            initial ? "/leads/" + initial.id : "/leads",
            { method: initial ? "PATCH" : "POST", body: JSON.stringify(f) },
          );
          if (result.duplicate) {
            setError(result.message);
            return;
          }
          onSaved();
        } catch (e: any) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Notice message={error} />
      <div className="form-grid">
        {[
          ["name", "Contact name"],
          ["company", "Company"],
          ["email", "Email"],
          ["phone", "Phone"],
          ["value", "Deal value"],
          ["source", "Lead source"],
        ].map(([key, label]) => (
          <Field key={key} label={label}>
            <input
              className="input"
              type={
                key === "value" ? "number" : key === "email" ? "email" : "text"
              }
              required={key === "name"}
              min={key === "value" ? 0 : undefined}
              step={key === "value" ? 0.01 : undefined}
              value={f[key]}
              onChange={(e) => setF({ ...f, [key]: e.target.value })}
            />
          </Field>
        ))}
      </div>
      {can(currentUser(), "lead.assign") && (
        <Field label="Assigned to">
          <select
            className="input"
            value={f.ownerId}
            onChange={(e) => setF({ ...f, ownerId: e.target.value })}
          >
            {users
              .filter((x) => x.active)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </select>
        </Field>
      )}
      <div className="form-actions">
        <button className="btn ghost" type="button" onClick={onClose}>
          Cancel
        </button>
        <button className="btn" disabled={busy}>
          {busy ? "Saving…" : initial ? "Save changes" : "Create lead"}
        </button>
      </div>
    </form>
  );
}
