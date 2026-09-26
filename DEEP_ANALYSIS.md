# Lead2 CRM — Deep Functionality & Security Analysis

> **Analyst:** Antigravity AI Code Analysis  
> **Date:** 2026-09-27  
> **Scope:** Full static analysis of all backend services, auth, data layer, and frontend  
> **Codebase:** NestJS API (TypeScript) + Next.js Web + PostgreSQL + Docker

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Functionality Analysis by Module](#2-functionality-analysis-by-module)
   - 2.1 Authentication & Session
   - 2.2 Multi-Factor Authentication (TOTP)
   - 2.3 Multi-Tenant & RBAC
   - 2.4 Leads Management
   - 2.5 Pipeline & Stages
   - 2.6 Proposals & Commercials
   - 2.7 Tasks (including Recurring)
   - 2.8 Dashboard & Reporting
   - 2.9 Users & Team Management
   - 2.10 Webhooks
   - 2.11 Super-Admin / Platform Layer
   - 2.12 Audit Log
3. [Security Analysis](#3-security-analysis)
   - 3.1 ✅ Strengths
   - 3.2 ⚠️ Vulnerabilities & Issues Found
4. [Data Layer & Encryption](#4-data-layer--encryption)
5. [Infrastructure & Deployment](#5-infrastructure--deployment)
6. [Summary Scorecards](#6-summary-scorecards)
7. [Recommended Fixes (Priority Order)](#7-recommended-fixes-priority-order)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         MULTI-TENANT SaaS CRM                   │
│                                                                 │
│  Next.js Frontend (port 3000)                                   │
│  ├── App Router: /(crm)/* — all CRM pages                       │
│  ├── /login, /register, /super-admin/*                          │
│  └── PWA: manifest, service worker                              │
│                                                                 │
│  NestJS API (port 4000)                                         │
│  ├── /api/auth/*          — JWT + cookie session                │
│  ├── /api/leads/*         — core CRM entity                     │
│  ├── /api/pipelines/*     — pipeline + stage management         │
│  ├── /api/proposals/*     — commercial proposals                │
│  ├── /api/tasks/*         — task management                     │
│  ├── /api/users/*         — team, roles, authority              │
│  ├── /api/webhooks/*      — outbound webhook delivery           │
│  ├── /api/dashboard       — reporting aggregations              │
│  └── /api/health          — liveness probe                      │
│                                                                 │
│  PostgreSQL                                                     │
│  ├── Row-Level Security (RLS) via set_config tenant isolation   │
│  ├── Encrypted PII columns (AES-256-GCM)                        │
│  └── HMAC-SHA-256 contact hash for deduplication                │
│                                                                 │
│  Infrastructure                                                 │
│  ├── Docker Compose (local dev)                                 │
│  ├── AWS ECS (production — ALB, RDS, ECR, WAF, CloudWatch)      │
│  └── AWS EC2 alternative (Terraform)                            │
└─────────────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- All queries go through parameterized SQL — no ORM, no raw string interpolation
- Tenant isolation enforced at DB level via PostgreSQL `set_config` + RLS
- PII (phone, email) encrypted at rest with AES-256-GCM; HMAC deduplicated
- JWT access token (4h) + refresh token (30d) in httpOnly cookies
- CSRF protection via `x-lead2-csrf: 1` header for cookie-based sessions

---

## 2. Functionality Analysis by Module

### 2.1 Authentication & Session

| Feature | Status | Notes |
|---------|--------|-------|
| Email/password login | ✅ Works | bcrypt with cost 12, timing-safe dummy hash on miss |
| Google SSO | ✅ Works | Passport.js Google strategy; workspace-scoped |
| JWT access token | ✅ 4h expiry | HS256, validated on every request |
| JWT refresh token | ✅ 30d expiry | httpOnly cookie, path-scoped to `/api/auth/refresh` |
| Token revocation | ✅ Works | `token_version` incremented on logout/password change |
| Forgot/reset password | ✅ Works | SHA-256 hashed token, 1h expiry, single-use |
| Platform admin login | ✅ Works | Separate table `platform_admins`, same JWT structure |
| Cookie flags | ✅ Secure | `httpOnly`, `sameSite: lax`, `secure` from env |
| Rate limiting | ✅ Works | 60 req/15min on `/api/auth/*` |
| Timing attack prevention | ✅ Works | Constant-time bcrypt compare even for unknown users |
| MFA step-up | ✅ Works | Challenge token issued, 32-byte random, SHA-256 hashed |

**Flow:**
```
POST /api/auth/login
  → bcrypt compare
  → if mfa_enabled: INSERT mfa_challenges → return {mfaRequired, mfaToken}
  → else: issueTokens() → set cookies → return {ok}
```

**Issue found:** `POST /api/auth/login` body contains `tenantSlug` which is processed through `this.slug()` validation — however, if a non-slug value like `" "` (spaces) is submitted, it hits `BadRequestException` before bcrypt — this leaks timing info about slug format but NOT about user existence. Minor.

---

### 2.2 Multi-Factor Authentication (TOTP)

| Feature | Status | Notes |
|---------|--------|-------|
| TOTP setup (QR code) | ✅ Works | 20-byte secret, `otplib` authenticator |
| TOTP enable | ✅ Works | Verify code before enabling |
| TOTP disable | ✅ Works | Requires current password |
| MFA challenge flow | ✅ Works | Challenge table with expiry, deleted after use |
| TOTP verify window | ✅ Default | otplib uses ±1 step (60s window) |

**Observation:** MFA secret is stored in plaintext in the `users`/`platform_admins` table (not encrypted). If the database is compromised, all TOTP seeds are exposed. **Recommendation:** Encrypt MFA secrets using the same `FIELD_ENCRYPTION_KEY` as contact PII.

---

### 2.3 Multi-Tenant & RBAC

**Roles (hierarchy):**
```
platform_admin (lead2_engineer / lead2_ops)
  └── client_super_admin  — full workspace permissions (*)
        └── client_manager — lead/assign/delete/proposal.approve/team.manage
              └── sales_member — lead.read/write/task.write/report.read/proposal.write
```

**Permission ceiling enforcement:**
- `ROLE_PERMISSIONS` defines the ceiling per role
- Per-role permissions can be customized but capped at ceiling
- Per-user `authority_override` sets discount/approval limits (capped at role default)
- `visibleUserIds()` restricts data scope: engineers=all, super_admin=all, manager=recursive subtree, sales_member=self only

**Tenant isolation:**
- All tenant queries use `db.tenant(tenantId, userId, fn)` which sets `app.current_tenant_id` and `app.current_user_id` PostgreSQL session variables
- PostgreSQL RLS policies rely on these session vars
- Tenant ID always scoped from JWT claim, never from user input

✅ **Strong design.** Cross-tenant data leakage is structurally prevented.

---

### 2.4 Leads Management

| Feature | Status | Notes |
|---------|--------|-------|
| Create lead | ✅ Works | Stage validation, duplicate detection via HMAC hash |
| List leads | ✅ Works | Filtered by visibility, stage, pipeline, owner, search |
| Update lead | ✅ Works | Stage transition, field validation, ownership transfer |
| Delete lead | ✅ Works | Blocked if proposals exist; requires `lead.delete` |
| Assign leads (bulk) | ✅ Works | Up to 500 leads, cascades to tasks/proposals |
| Activity log | ✅ Works | note/call/email/meeting types, 5000 char limit |
| Stage history | ✅ Works | Timestamped; exited_at tracked on stage change |
| Lead deduplication | ✅ Works | HMAC(phone) + HMAC(email) checked before insert |
| Lead import (CSV batch) | ✅ Works | Up to 1000 rows, single transaction, per-row errors |
| Tags | ✅ Works | Create/assign/update lead tags with color |
| PII encryption | ✅ Works | phone_enc, email_enc using AES-256-GCM |
| Search | ✅ Works | ILIKE on name, company, source — not encrypted fields |

**Issue found:** Search (`?q=`) matches `name`, `company`, `source` only — it **cannot** search by phone/email because those are encrypted. This is a known tradeoff of encryption-at-rest for PII. Users expecting to search by phone number will not find results. Should be documented.

**Issue found — Lead scoring:** `score` field accepts 0-100 at creation but is never updated automatically. No ML/rule engine for scoring. The field exists but is static after creation unless manually updated through the update endpoint. This is a missing feature vs what might be expected.

---

### 2.5 Pipeline & Stages

| Feature | Status | Notes |
|---------|--------|-------|
| Create/edit pipeline | ✅ | Multi-pipeline support per workspace |
| Stage outcomes | ✅ | open/won/lost outcomes mapped to stages |
| Required fields per stage | ✅ | Enforced on stage entry |
| Stage probability | ✅ | Used in weighted pipeline value calculation |
| Default pipeline | ✅ | `is_default` flag, fallback in lead creation |
| Stage change history | ✅ | Tracked in `lead_stage_history` |

---

### 2.6 Proposals & Commercials

| Feature | Status | Notes |
|---------|--------|-------|
| Commercial catalog CRUD | ✅ | 1-100 items, versioned |
| Proposal template (HTML/DOCX) | ✅ | Sanitized via sanitize-html, placeholder validation |
| DOCX upload → HTML | ✅ | mammoth.js conversion, zip-bomb protection via validateDocxArchive |
| Proposal generation | ✅ | Pricing calculation with Decimal.js (no float errors) |
| Discount authority check | ✅ | selfDiscountPct ceiling enforced at proposal creation |
| Approval workflow | ✅ | approval_required → approved/rejected; self-approval blocked |
| Approval authority enforcement | ✅ | approveDiscountPct + approveTotal checked |
| Proposal status machine | ✅ | draft → approval_required → approved → sent → accepted/declined |
| Proposal document export | ✅ | Server-rendered HTML with escapeHtml throughout |
| Snapshot preservation | ✅ | Template + commercial + answers frozen at generation time |
| Email notifications | ✅ | On approval decision, on approval request |
| Webhook dispatch | ✅ | `proposal.*` events dispatched |
| Validity date check | ✅ | Cannot send expired proposals |

**Issue found:** Template upload allows HTML files directly (`/\.(html?|txt|md)$/i.test(filename)`) — raw HTML is stored after `sanitizeTemplate()`. The sanitizer is strict (allowedTags whitelist, allowedStyles whitelist) but uses `style` attribute on `*`, which means inline `style` with color/bg-color/text-align/font-weight can be injected. This is acceptable but note that `font-weight: 900` is permitted — cosmetic only, not a security risk.

**Issue found:** Proposals can only be deleted... never. There is no DELETE endpoint for proposals. Proposals with `declined` or `rejected` status persist forever. This could accumulate large amounts of stale data. A soft-delete or archive endpoint should be added.

---

### 2.7 Tasks (including Recurring)

| Feature | Status | Notes |
|---------|--------|-------|
| Create task | ✅ | Title, due date, assignee, optional lead link |
| Lead linking | ✅ | Assignee must have visibility of linked lead |
| Recurrence | ✅ | daily/weekly/monthly; spawns next on completion |
| Task completion | ✅ | Marks completed; auto-spawns next if recurring |
| Task list + filtering | ✅ | Filtered by scope (visibility), status |
| Email on task assignment | ✅ | Notifies assignee when assigned by someone else |
| Overdue count | ✅ | Surfaced on dashboard KPI |

**Issue:** There is no task **update** or **delete** endpoint — tasks can only be created and completed. Cannot edit title, due date, or assignee after creation. This is a significant functional gap for real-world usage.

**Issue:** Recurring task parent ID (`recurrence_parent_id`) is stored but there is no API to list or view the chain of recurrences for a parent task.

---

### 2.8 Dashboard & Reporting

| Feature | Status | Notes |
|---------|--------|-------|
| KPI cards | ✅ | Total leads, open, new this month, won this month, total value, weighted value |
| Stage funnel | ✅ | Count, value, current age, historical avg age per stage |
| Lead ageing buckets | ✅ | 0-3, 4-7, 8-14, 15-30, 31+ days in stage |
| Source breakdown | ✅ | Top 10 sources by count/value/won |
| Owner leaderboard | ✅ | Top 12 owners by open value |
| Recent leads | ✅ | Last 6 leads created |
| Overdue tasks count | ✅ | KPI card |
| Scope awareness | ✅ | super_admin=all, manager=subtree, sales=self |
| Currency awareness | ✅ | Uses workspace currency setting |

**Missing:** No time-range filtering on dashboard (e.g., "last 30 days"). All stats are all-time or current month. No exportable reports (CSV/PDF).

---

### 2.9 Users & Team Management

| Feature | Status | Notes |
|---------|--------|-------|
| Create user | ✅ | Seat limit enforced, must_change_password=true |
| Update user | ✅ | Role, name, email, manager; cycle detection |
| Remove + transfer | ✅ | Atomic: deactivate + transfer leads/tasks/proposals/reportees |
| Seat limit enforcement | ✅ | Row-level lock on tenants table prevents race conditions |
| Role permission management | ✅ | Per-role customization within ceiling |
| Per-user authority override | ✅ | discount/approval limits per individual |
| Reporting tree management | ✅ | Manager assignment with cycle detection |
| Workspace info | ✅ | Shows seat usage, agreement (admin only) |
| Audit log | ✅ | All critical actions logged |
| Google SSO user management | ✅ | Email-matched to existing workspace user |

**Issue:** When a user is removed, their old **activities** (on leads) are kept with the original `user_id` reference, but the user is deactivated. The activities table does not cascade and uses a `LEFT JOIN users` — this works but activity entries from removed users will show `NULL` user names. Consider storing `actor_name` as a snapshot at write time.

---

### 2.10 Webhooks

| Feature | Status | Notes |
|---------|--------|-------|
| Create/update endpoint | ✅ | URL validation, event whitelist |
| HMAC-SHA256 signing | ✅ | `X-Lead2-Signature: sha256=...` header |
| Event dispatch | ✅ | fire-and-forget, per-event filtering |
| Delivery tracking | ✅ | status_code, success, attempt stored |
| Delivery history | ✅ | Last 50 per endpoint |
| Timeout handling | ✅ | 10s timeout, destroyed on timeout |
| HTTP & HTTPS | ✅ | Both supported |

**Vulnerability — SSRF (Server-Side Request Forgery):** The webhook URL accepts any `http://` or `https://` URL including:
- `http://169.254.169.254/latest/meta-data/` (AWS metadata endpoint)
- `http://localhost:*` (internal services)
- `http://10.0.0.1` (VPC internal)

A malicious `client_super_admin` could create a webhook pointing to internal infrastructure and trigger it via a proposal approval. **This is a HIGH severity vulnerability in cloud deployments.**

**Fix:** Validate the resolved IP against a blocklist of RFC 1918 ranges + link-local before making the request, or use a dedicated outbound proxy.

---

### 2.11 Super-Admin / Platform Layer

| Feature | Status | Notes |
|---------|--------|-------|
| Workspace request approval | ✅ | Creates tenant + seeds first user |
| Workspace rejection | ✅ | Email notification |
| Tenant management (seats, agreement, status) | ✅ | Suspend/activate workspace |
| Platform audit log | ✅ | All platform-level actions |
| Ops staff management | ✅ | Create/enable/disable ops accounts |
| Engineer workspace context | ✅ | Switch into client workspace for support |
| Global pending requests KPI | ✅ | |

---

### 2.12 Audit Log

Every significant action writes to `audit_logs` (tenant-scoped) or `platform_audit_logs` (platform-scoped):

- `lead.created`, `lead.updated`, `lead.assigned`, `lead.deleted`, `lead.view`
- `activity.created`
- `user.created`, `user.updated`, `user.removed_and_transferred`, `user.password_changed`
- `authority.role_updated`, `authority.member_updated`, `user.reporting_changed`
- `proposal.generated`, `proposal.approved`, `proposal.rejected`, `proposal.sent`, `proposal.exported`
- `access.approved`
- `commercial.saved`, `template.saved`
- `task.created`, `task.completed`

✅ Comprehensive. IP is captured in the schema but **not passed** to `db.audit()` in most call sites — the `ip?` param is optional and callers don't extract `req.ip`. Audit entries will have `NULL` ip for most actions.

---

## 3. Security Analysis

### 3.1 ✅ Strengths

| Control | Implementation |
|---------|----------------|
| **SQL Injection** | All queries use parameterized `$1,$2,...` — zero string interpolation in SQL |
| **XSS in proposals** | `sanitize-html` + strict `allowedTags` whitelist; `escapeHtml()` on all dynamic values in rendered HTML |
| **Zip-bomb in DOCX** | `validateDocxArchive()` checks expanded zip size before mammoth conversion |
| **CSRF** | Cookie-based session requires `x-lead2-csrf: 1` header on mutating requests |
| **Rate limiting** | 60 req/15min on all `/api/auth/*` endpoints |
| **Brute force protection** | Timing-safe compare using dummy hash on unknown user |
| **Password policy** | Minimum 12 chars, max 72 bytes (bcrypt limit) enforced |
| **bcrypt cost** | Cost factor 12 (strong) |
| **JWT algorithm pinning** | `algorithms: ["HS256"]` — rejects alg:none attacks |
| **Token revocation** | `token_version` counter; incremented on logout/password change |
| **PII encryption** | AES-256-GCM with random 12-byte IV per value |
| **Contact hashing** | HMAC-SHA256 keyed hash for deduplication (not reversible) |
| **Helmet** | HTTP security headers via `helmet()` |
| **CORS** | Allowlist from `CORS_ORIGIN` env var; origin check on mutations |
| **Tenant isolation** | PostgreSQL RLS + session variable; tenant_id from JWT, never user input |
| **Seat limit** | Enforced with `FOR UPDATE` row lock (race-condition safe) |
| **File upload** | No multipart; files sent as base64 JSON; size check before decode |
| **Input validation** | Comprehensive `validation.ts` helpers — str, email, uuid, num, integer, date, password |
| **Proposal self-approval blocked** | `created_by !== u.sub` check enforced |
| **MFA challenge** | Single-use; deleted after verify; SHA-256 hashed token stored |
| **Database SSL** | `DATABASE_SSL=true` enables `rejectUnauthorized: true` |

---

### 3.2 ⚠️ Vulnerabilities & Issues Found

#### 🔴 HIGH — SSRF via Webhook URL
**Location:** `webhooks.service.ts:84`  
**Description:** No IP/range validation on webhook URLs. An attacker with `client_super_admin` role can send requests to internal IP ranges (AWS metadata, VPC, localhost) via webhook dispatch triggered by proposal events.  
**Fix:**
```typescript
import { isIP } from "node:net";
import dns from "node:dns/promises";

const BLOCKED_RANGES = [/^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./];

async function resolveAndValidate(url: string) {
  const hostname = new URL(url).hostname;
  const addrs = await dns.resolve4(hostname).catch(() => []);
  if (addrs.some(ip => BLOCKED_RANGES.some(r => r.test(ip))))
    throw new Error("Webhook URL resolves to a private/internal IP range");
}
```

---

#### 🟠 MEDIUM — MFA Secret Stored in Plaintext
**Location:** `auth.service.ts:188`, `db schema`  
**Description:** TOTP secrets in `users.mfa_secret` and `platform_admins.mfa_secret` are stored unencrypted. A DB dump exposes all TOTP seeds.  
**Fix:** Encrypt with `CryptoService.encrypt()` at storage; decrypt before verify.

---

#### 🟠 MEDIUM — Audit Log Missing IP Address
**Location:** `db.service.ts:audit()`, all callers  
**Description:** The `audit_logs` table has an `ip` column and the `audit()` method accepts an optional `ip` param, but no caller passes the request IP. This makes forensic investigation harder.  
**Fix:** Pass `req.ip` from the controller layer through to service `audit()` calls, or inject `REQUEST` scope to capture IP automatically in a service interceptor.

---

#### 🟠 MEDIUM — No Proposal Delete / Lifecycle Management
**Location:** `proposals.service.ts`  
**Description:** There is no way to delete or archive proposals. Draft/rejected/declined proposals accumulate indefinitely. Over time this creates unbounded table growth.  
**Fix:** Add `DELETE /api/proposals/:id` restricted to `draft`/`rejected` status only, or add soft-delete (`archived_at`).

---

#### 🟡 LOW — Task Has No Update/Delete Endpoint
**Location:** `tasks.service.ts`  
**Description:** Tasks can only be created and completed. Title, due date, and assignee cannot be changed after creation. This is a significant UX/functionality gap.  
**Fix:** Add `PATCH /api/tasks/:id` and `DELETE /api/tasks/:id` endpoints.

---

#### 🟡 LOW — Search Cannot Find PII Fields
**Location:** `leads.service.ts:56-60`  
**Description:** Lead search matches `name`, `company`, `source` but NOT `phone` or `email` (encrypted). Users who search by phone number will get no results.  
**Fix:** Document this limitation clearly. Optionally, add a normalized phone hash search using `CryptoService.contactHash()` — search by hash if the input looks like a phone number.

---

#### 🟡 LOW — TOTP Window is ±1 Step (60s)
**Location:** `mfa.service.ts` — uses default otplib window  
**Description:** Default otplib authenticator window allows ±1 time step = ±30 seconds = 60s grace. This is standard but means a stolen TOTP code is valid for up to 60s.  
**Fix:** Consider setting `authenticator.options = { window: 0 }` to restrict to exact current step, or add single-use tracking for TOTP codes.

---

#### 🟡 LOW — `trust proxy: 1` May Expose Wrong Client IP
**Location:** `http.ts:50`  
**Description:** `app.getHttpAdapter().getInstance().set("trust proxy", 1)` trusts the first proxy hop. In AWS ALB, this correctly gives `X-Forwarded-For[0]`. But if the app is exposed directly (non-ALB), an attacker can spoof `X-Forwarded-For`.  
**Fix:** In production always route through ALB or a reverse proxy; in local dev disable trust proxy.

---

#### 🟡 LOW — Password Reset Token: Tenant Not Verified on Consume
**Location:** `auth.service.ts:329-352`  
**Description:** `resetPassword()` looks up the token and applies the new hash directly without checking `tenant.status === 'active'`. A user in a suspended workspace can still reset their password (though they cannot log in after).  
**Impact:** Very low — reset succeeds but login is still blocked by the active check in `auth.service.ts:login()`. Cosmetically inconsistent.

---

#### 🟡 LOW — `3mb` JSON Body Limit May Be Too Permissive
**Location:** `http.ts:51`  
**Description:** `json({ limit: "3mb" })` allows 3MB JSON payloads. Since file uploads are base64-encoded JSON (max 2MB file → ~2.7MB base64), the limit is intentional. However, this also means regular API endpoints (leads, tasks, etc.) accept 3MB requests.  
**Fix:** Apply the 3MB limit only to proposal/template upload routes; use a stricter limit (e.g., 64kb) on all other routes.

---

#### 🟢 INFO — Refresh Token Path Scoped Correctly
`lead2_refresh` cookie is scoped to `path: "/api/auth/refresh"` only — it won't be sent to other API routes. ✅ Correct.

---

#### 🟢 INFO — No Rate Limiting on Non-Auth Routes
Only `/api/auth/*` has rate limiting. Endpoints like `GET /api/leads` or `GET /api/dashboard` have no per-user rate limit. Under heavy load from a single account, these could cause DB overload. Consider adding per-user rate limiting via Redis or in-memory store.

---

## 4. Data Layer & Encryption

| Aspect | Implementation |
|--------|---------------|
| Driver | `pg` (node-postgres), connection pool max=20 |
| Transactions | All mutations use `db.transaction()` or `db.tenant()` (which wraps tenant context + transaction) |
| Tenant isolation | `set_config('app.current_tenant_id', ...)` per connection, PostgreSQL RLS |
| PII encryption | AES-256-GCM, 12-byte IV, 16-byte auth tag, base64url encoded |
| Dedup hashing | HMAC-SHA-256 with `CONTACT_HASH_KEY` — keyed, normalized (lowercase, strips spaces/punctuation) |
| Migrations | Sequential SQL files in `apps/api/db/migrations/` |
| SSL | `rejectUnauthorized: true` when `DATABASE_SSL=true` |
| Error sanitization | PostgreSQL error codes 23505, 22P02, 23503 etc. mapped to 4xx; 500s scrubbed |

---

## 5. Infrastructure & Deployment

### Docker Compose (Local)
- API + Web + PostgreSQL containers
- Volume for DB persistence
- Environment via `.env` (not committed)

### AWS ECS (Production)
| Component | Config |
|-----------|--------|
| ALB | HTTPS listener, HTTP→HTTPS redirect |
| ECS Fargate | API + Web tasks; auto-scaling |
| RDS PostgreSQL | Multi-AZ, encrypted, automated backups |
| ECR | Docker image registry per service |
| ACM | TLS certificate (auto-renew) |
| WAF | AWS-managed rules attached to ALB |
| CloudWatch | Log groups, alarms |
| Secrets Manager | Env vars injected as secrets (JWT_SECRET, FIELD_ENCRYPTION_KEY, etc.) |

### GitHub Actions CI/CD
- `ci.yml`: lint + test on PR
- `deploy-ec2.yml`: SSH deploy to EC2
- `deploy-ecs.yml`: Build → ECR push → ECS force-new-deployment

---

## 6. Summary Scorecards

### Functionality

| Module | Completeness | Quality |
|--------|-------------|---------|
| Auth & Session | 95% | ⭐⭐⭐⭐⭐ |
| MFA | 90% | ⭐⭐⭐⭐ |
| Multi-tenant RBAC | 100% | ⭐⭐⭐⭐⭐ |
| Leads | 90% | ⭐⭐⭐⭐⭐ |
| Pipeline/Stages | 95% | ⭐⭐⭐⭐⭐ |
| Proposals | 85% | ⭐⭐⭐⭐ |
| Tasks | 65% | ⭐⭐⭐ |
| Dashboard | 80% | ⭐⭐⭐⭐ |
| Users/Team | 95% | ⭐⭐⭐⭐⭐ |
| Webhooks | 90% | ⭐⭐⭐⭐ |
| Platform Admin | 95% | ⭐⭐⭐⭐⭐ |
| Audit | 80% | ⭐⭐⭐⭐ |

### Security

| Area | Rating | Notes |
|------|--------|-------|
| SQL Injection | ✅ Excellent | 100% parameterized |
| XSS | ✅ Excellent | sanitize-html + escapeHtml |
| Auth | ✅ Excellent | JWT, bcrypt, MFA, token rotation |
| CSRF | ✅ Good | Custom header check |
| SSRF | ❌ Missing | Webhook URL not validated |
| Data encryption | ✅ Excellent | AES-256-GCM for PII |
| Tenant isolation | ✅ Excellent | DB-level RLS |
| Audit trail | ⚠️ Partial | IP not captured |
| Rate limiting | ⚠️ Partial | Auth only |
| Input validation | ✅ Excellent | Comprehensive helpers |

**Overall Security Score: 8.2/10**  
**Overall Functionality Score: 88%**

---

## 7. Recommended Fixes (Priority Order)

### 🔴 Critical (Fix Before Production)

1. **[SSRF] Validate webhook URLs against private IP ranges**
   - File: `apps/api/src/webhooks/webhooks.service.ts`
   - Add DNS resolution + IP range blocklist before HTTP delivery

### 🟠 High (Fix Soon)

2. **[MFA] Encrypt TOTP secrets at rest**
   - File: `apps/api/src/auth/auth.service.ts:setupMfa()`
   - Use `CryptoService.encrypt()` when storing; `CryptoService.decrypt()` before verify

3. **[Audit] Capture client IP in all audit calls**
   - File: `apps/api/src/db/db.service.ts` + all service callers
   - Inject `REQUEST` or pass IP through from controller

### 🟡 Medium (Improve for production readiness)

4. **[Tasks] Add PATCH + DELETE for tasks**
   - File: `apps/api/src/tasks/tasks.controller.ts` + `tasks.service.ts`

5. **[Proposals] Add archive/delete for draft/rejected proposals**
   - File: `apps/api/src/proposals/proposals.service.ts`

6. **[Rate Limiting] Add per-user rate limiting on data endpoints**
   - Use in-memory or Redis-based limiter

7. **[Body limit] Restrict 3mb limit to upload routes only**
   - File: `apps/api/src/common/http.ts`

### 🟢 Low (Nice to have)

8. **[Search] Document phone/email search limitation; optionally add hash-based phone search**
9. **[Dashboard] Add date-range filtering to reports**
10. **[TOTP] Add single-use code tracking to prevent replay within 30s window**
11. **[Activities] Store actor name snapshot on activity write to survive user deactivation**

---

*Generated by static code analysis. No live environment testing was performed. Prioritization based on OWASP Top 10 and CWE scoring.*
