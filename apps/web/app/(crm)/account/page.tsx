"use client";
import { useState } from "react";
import { api, currentUser, clearSession } from "../../../lib/api";
import { PageHead, Field, Notice } from "../../../components/UI";
export default function Account() {
  const u = currentUser(),
    [f, setF] = useState({ currentPassword: "", password: "", confirm: "" }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <PageHead
        eyebrow="YOUR ACCOUNT"
        title={
          u?.mustChangePassword ? "Set your own password" : "Account & security"
        }
        description={
          u?.mustChangePassword
            ? "Change your temporary password to activate workspace access."
            : "Manage the password for your Lead2 account."
        }
      />
      <div className="card" style={{ maxWidth: 550 }}>
        <Notice message={error} />
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            if (f.password !== f.confirm) {
              setError("The new passwords don’t match");
              return;
            }
            setBusy(true);
            try {
              await api("/auth/change-password", {
                method: "POST",
                body: JSON.stringify(f),
              });
              clearSession();
              location.href = "/login";
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Current password">
            <input
              required
              type="password"
              autoComplete="current-password"
              className="input"
              value={f.currentPassword}
              onChange={(e) => setF({ ...f, currentPassword: e.target.value })}
            />
          </Field>
          <Field
            label="New password"
            hint="Use at least 12 characters. You’ll sign in again after saving."
          >
            <input
              required
              minLength={12}
              type="password"
              autoComplete="new-password"
              className="input"
              value={f.password}
              onChange={(e) => setF({ ...f, password: e.target.value })}
            />
          </Field>
          <Field label="Confirm new password">
            <input
              required
              type="password"
              autoComplete="new-password"
              className="input"
              value={f.confirm}
              onChange={(e) => setF({ ...f, confirm: e.target.value })}
            />
          </Field>
          <button className="btn" disabled={busy}>
            {busy ? "Saving…" : "Change password"}
          </button>
        </form>
      </div>
    </>
  );
}
