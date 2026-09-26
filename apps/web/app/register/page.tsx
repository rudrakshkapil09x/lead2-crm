"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../lib/api";
import { AuthFrame } from "../../components/AuthPage";
import { Field, Notice } from "../../components/UI";
export default function Register() {
  const [f, setF] = useState<any>({
      requestType: "workspace",
      tenantName: "",
      tenantSlug: "",
      name: "",
      email: "",
      password: "",
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<any>(null);
  async function submit(e: any) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setResult(
        await api("/auth/register-request", {
          method: "POST",
          body: JSON.stringify(f),
        }),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame>
      <div className="authbox">
        <div className="eyebrow">LET’S GET STARTED</div>
        <h1>{result ? "You’re on the list." : "A workspace for your team."}</h1>
        <p>
          {result
            ? `Your request is ${result.status}. ${f.requestType === "workspace" ? "Lead2 Ops will review your commercial agreement and activate the workspace." : "Your Client Super Admin will review your request."}`
            : "Tell us a little about yourself. We’ll take it from there."}
        </p>
        <Notice message={error} />
        {result ? (
          <div className="form">
            <div className="success-panel">
              <h2>{f.tenantName || f.tenantSlug}</h2>
              <p>{f.email}</p>
              <p className="subtle">
                Keep this page open to check your approval status.
              </p>
            </div>
            <button
              className="btn secondary"
              onClick={async () => {
                try {
                  setResult({
                    ...result,
                    ...(await api(
                      "/auth/registration-status?requestId=" + result.id,
                    )),
                  });
                } catch (e: any) {
                  setError(e.message);
                }
              }}
            >
              Check approval status
            </button>
            <Link href="/login" className="btn">
              Continue to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="segmented">
              <button
                type="button"
                className={f.requestType === "workspace" ? "active" : ""}
                onClick={() => setF({ ...f, requestType: "workspace" })}
              >
                New workspace
              </button>
              <button
                type="button"
                className={f.requestType === "join" ? "active" : ""}
                onClick={() => setF({ ...f, requestType: "join" })}
              >
                Join a team
              </button>
            </div>
            <form onSubmit={submit} className="form">
              {f.requestType === "workspace" && (
                <Field label="Company name">
                  <input
                    required
                    className="input"
                    value={f.tenantName}
                    onChange={(e) => setF({ ...f, tenantName: e.target.value })}
                  />
                </Field>
              )}
              <Field
                label="Workspace slug"
                hint="Lowercase letters, numbers, and hyphens."
              >
                <input
                  required
                  className="input"
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  value={f.tenantSlug}
                  onChange={(e) => setF({ ...f, tenantSlug: e.target.value })}
                />
              </Field>
              <Field label="Full name">
                <input
                  required
                  className="input"
                  value={f.name}
                  onChange={(e) => setF({ ...f, name: e.target.value })}
                />
              </Field>
              <Field label="Work email">
                <input
                  required
                  type="email"
                  className="input"
                  value={f.email}
                  onChange={(e) => setF({ ...f, email: e.target.value })}
                />
              </Field>
              <Field
                label="Password"
                hint="At least 12 characters; maximum 72 UTF-8 bytes."
              >
                <input
                  required
                  minLength={12}
                  autoComplete="new-password"
                  type="password"
                  className="input"
                  value={f.password}
                  onChange={(e) => setF({ ...f, password: e.target.value })}
                />
              </Field>
              <button className="btn" disabled={busy}>
                {busy ? "Submitting…" : "Request access →"}
              </button>
            </form>
            <div className="auth-links">
              <Link href="/login">
                Already have access? <b>Sign in</b>
              </Link>
            </div>
          </>
        )}
      </div>
    </AuthFrame>
  );
}
