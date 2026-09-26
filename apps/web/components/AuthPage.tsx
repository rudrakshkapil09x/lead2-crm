"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { api, signIn } from "../lib/api";
import { Field, Notice } from "./UI";
export function Logo() {
  return (
    <Link href="/login" className="brand">
      <span className="brand-mark">
        L<span>2</span>
      </span>
      <span>
        Lead2<span className="brand-crm">CRM</span>
      </span>
    </Link>
  );
}
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-story">
        <Logo />
        <div className="auth-story-content">
          <div className="auth-pill">
            <span className="live-dot" />A little clarity. A lot of possibility.
          </div>
          <h1>
            Build relationships.
            <br />
            Move business
            <br />
            forward.
          </h1>
          <p>
            One connected workspace for your people, your pipeline, and every
            opportunity ahead.
          </p>
        </div>
        <footer>From first conversation to the next big win.</footer>
        <div className="auth-orbit" />
      </aside>
      <div className="auth-panel">
        <div className="auth-logo-mobile">
          <Logo />
        </div>
        {children}
      </div>
    </div>
  );
}
export default function AuthPage({ platform = false }: { platform?: boolean }) {
  const [f, setF] = useState({ tenantSlug: "", email: "", password: "" }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: any) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const u = await signIn(f, platform);
      location.href = u.mustChangePassword
        ? "/account"
        : platform
          ? "/super-admin"
          : "/dashboard";
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame>
      <div className="authbox">
        <div className="eyebrow">
          {platform ? "LEAD2 CONTROL CENTER" : "WELCOME TO LEAD2"}
        </div>
        <h1>{platform ? "Platform sign in" : "Good to see you again."}</h1>
        <p>
          {platform
            ? "For Lead2 Engineers and Approver / Ops team members."
            : "Sign in to your workspace and pick up where you left off."}
        </p>
        <Notice message={error} />
        <form className="form" onSubmit={submit}>
          {!platform && (
            <Field label="Workspace">
              <input
                autoComplete="organization"
                required
                className="input"
                placeholder="your-company"
                value={f.tenantSlug}
                onChange={(e) => setF({ ...f, tenantSlug: e.target.value })}
              />
            </Field>
          )}
          <Field label="Work email">
            <input
              autoComplete="username"
              required
              className="input"
              type="email"
              placeholder="you@company.com"
              value={f.email}
              onChange={(e) => setF({ ...f, email: e.target.value })}
            />
          </Field>
          <Field label="Password">
            <input
              autoComplete="current-password"
              required
              className="input"
              type="password"
              placeholder="Your password"
              value={f.password}
              onChange={(e) => setF({ ...f, password: e.target.value })}
            />
          </Field>
          <button className="btn" disabled={busy}>
            {busy
              ? "Signing in…"
              : "Sign in to " + (platform ? "Lead2" : "workspace")}
            <ArrowRight size={15} />
          </button>
        </form>
        <div className="auth-links">
          {!platform && (
            <Link href="/register">
              New to Lead2? <b>Request workspace access</b>
            </Link>
          )}
          <Link href={platform ? "/login" : "/super-admin/login"}>
            {platform
              ? "← Back to client sign in"
              : "Lead2 team member? Platform sign in →"}
          </Link>
          <span>
            Need help signing in? Contact your workspace administrator.
          </span>
        </div>
      </div>
    </AuthFrame>
  );
}
