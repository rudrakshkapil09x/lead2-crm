"use client";
import { useState } from "react";
import { api, clearSession } from "../lib/api";
import { Modal, Field, Notice } from "./UI";
export default function PasswordDialog({
  platform = false,
}: {
  platform?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [f, setF] = useState({ currentPassword: "", password: "", confirm: "" });
  return (
    <>
      <button className="btn ghost" onClick={() => setOpen(true)}>
        Change password
      </button>
      {open && (
        <Modal title="Change your password" onClose={() => setOpen(false)}>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              if (f.password !== f.confirm) {
                setError("New passwords do not match");
                return;
              }
              setBusy(true);
              try {
                await api("/auth/change-password", {
                  method: "POST",
                  body: JSON.stringify(f),
                });
                clearSession();
                location.href = platform ? "/super-admin/login" : "/login";
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Notice message={error} />
            {[
              ["currentPassword", "Current password"],
              ["password", "New password"],
              ["confirm", "Confirm new password"],
            ].map(([key, label]) => (
              <Field label={label} key={key}>
                <input
                  required
                  minLength={key === "currentPassword" ? undefined : 12}
                  className="input"
                  type="password"
                  autoComplete={
                    key === "currentPassword"
                      ? "current-password"
                      : "new-password"
                  }
                  value={(f as any)[key]}
                  onChange={(e) => setF({ ...f, [key]: e.target.value })}
                />
              </Field>
            ))}
            <p className="subtle">
              Use at least 12 characters. Changing the password signs out
              existing sessions.
            </p>
            <button className="btn" disabled={busy}>
              Save password
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
