# Lead2 CRM v3 — security and release gates

This package is suitable for functional evaluation and pilot development. Complete the gates below before public production use with customer data.

## Implemented controls

- Separate platform roles and three fixed client roles. Engineers are provisioned through an operator CLI; Ops cannot open client CRM workspaces.
- PostgreSQL tenant RLS under the non-owner `crm_app` role. Explicit API scope limits managers to their reporting subtree and sales members to their own records.
- Cross-tenant relationship triggers and service validation for users, managers, stages, leads, activities, tasks and proposals.
- Transactional seat allocation and removal/replacement. Last-super-admin and reporting-cycle protection.
- HttpOnly, SameSite=Lax session cookies; Secure cookies in the HTTPS deployment. Cookie mutations require a custom verification header, and unapproved browser origins are rejected.
- Fresh database membership, role, account status, token version and client agreement expiry checks on each authenticated request. Password changes and deactivation revoke old sessions.
- bcrypt password hashes and mandatory changes for client temporary passwords. Lead phone/email fields use AES-256-GCM, with HMAC duplicate keys.
- Server-owned commercial prices, decimal calculations, approval state transitions, no manager self-approval, and immutable proposal snapshots.
- Sanitized templates, bounded DOCX ZIP inspection, escaped proposal values and no remote template resources. No uploaded documents are extracted to the filesystem.
- All multipart requests return HTTP 415 before route handling; uploads use bounded JSON/base64 bodies instead.
- Parameterized SQL, API errors that do not expose SQL text, authentication rate limiting, no authenticated service-worker cache, and tenant/platform audit events.

## Known dependency gate

The completed dependency audit initially reported four high-severity entries: `adm-zip`, `multer`, and the two NestJS packages that bring in Multer (`@nestjs/platform-express` and `@nestjs/core`). The direct `adm-zip` dependency has been removed and replaced by bounded native ZIP validation with tests.

The lockfile still contains **Multer 2.2.0 through the inherited NestJS adapter**, with the advisory chain reported by that audit. This application does not instantiate Multer upload interceptors and rejects multipart requests at the first middleware layer, so those multipart paths are not exposed by the implemented API. This mitigation is not a substitute for upgrading the dependency chain.

Package-registry access became blocked in the build environment before a compatible full NestJS upgrade could be installed and retested. The archive therefore retains the exact tested dependency lockfile instead of claiming an unverified upgrade. Before production, resolve compatible patched NestJS/core/platform/testing/JWT versions, run `npm audit --omit=dev`, and rerun the tests and build. The audit reported NestJS 12.0.3 as a fix target for the adapter chain; verify peer compatibility rather than forcing that major version blindly.

The manual GitHub deployment workflow includes `npm audit --omit=dev --audit-level=high` and is expected to block until the advisory chain is resolved. Local demo and Docker pilot operation remain available.

Advisory references from the audit include:

- https://github.com/advisories/GHSA-wc9g-mqfw-jrwm
- https://github.com/advisories/GHSA-qfvm-cv95-jqjf
- https://github.com/advisories/GHSA-qvfw-j98x-7q72
- https://github.com/advisories/GHSA-535w-7cp7-47q4

## Operational gates

1. Resolve the dependency gate and independently review authorization, account recovery and document handling.
2. Run the included browser acceptance checklist on desktop and mobile, including keyboard and screen-reader use. Browser execution was unavailable in the build sandbox.
3. Test the Docker images and migrations on a real PostgreSQL 16 host, including competing connections and backup/restore.
4. Configure a real HTTPS domain, secrets management, off-host backups, monitoring and alerts. Do not expose database/API ports publicly.
5. Add SSO/MFA and a verified recovery mechanism before broad enterprise rollout. Password resets in this release are administrator-managed for clients; engineers have code-level recovery.
6. Load-test the application's current query limits and replace the single-host topology when required.

Audit rows cannot be updated/deleted by the runtime role, but this is not an immutable external audit system. Database owners can still administer records. Operational access and exported audits need their own controls.

Agreement amounts are records, not payment processing. Proposal printing is browser-based. The app does not provide legal/compliance certification, external provider integration, or full Salesforce/HubSpot parity.
