# Lead2 CRM — complete v3 source

Lead2 CRM is a working multi-tenant sales application built from the uploaded Perpetual CRM v2 code. This package includes the Next.js frontend, NestJS backend, PostgreSQL schema and upgrade migration, tests, Docker deployment, an AWS starter, and GitHub workflows.

**Release status: functional pilot.** The requested five-role model, seat allocation, user handovers, reporting trees, authority limits, client commercials, and guided proposal generation are implemented. This release does not claim feature parity with Salesforce or HubSpot. See `SECURITY.md` and `BUILD_REPORT.md` for the remaining production gates and exact validation results.

## Five roles

| Role                     | Access and responsibilities                                                                                                                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lead2 Engineer**       | Provisioned by the system operator at the command line. Full platform access and audited access to any client workspace. Does not consume a client seat.                                                                                |
| **Lead2 Approver / Ops** | Approves new client workspaces and records commercial agreements, licensed seat counts, and suspension. Cannot access client CRM records or create engineers.                                                                           |
| **Client Super Admin**   | Manages client users, roles, reporting lines, user replacement, workspace authority, pipelines, commercial catalogs, proposal templates, and audit history.                                                                             |
| **Client Manager**       | Sees their own records and the full reporting subtree, including nested managers. Assigns work within that scope, changes subordinate reporting lines, applies subordinate authority limits, and reviews proposals within their limits. |
| **Sales Team Member**    | Works with their own leads, tasks and proposals. Cannot administer accounts, see other teams, change catalog prices, or approve proposals.                                                                                              |

Every active client user—including super admins and managers—uses one licensed seat. Client administrators cannot change the seat limit. Role checks and record scope are enforced in the API; hiding a UI control is not the security boundary.

## Start a disposable demo in two commands

Requirements: Node.js **24.9 or newer**, npm, and package-registry access for the first install.

```bash
npm ci
npm run demo
```

Open **http://localhost:3000**. The demo uses an in-memory PostgreSQL engine (PGlite) with the same API and row-security policies. It binds locally, resets when stopped, and must not be used for real customer data.

Workspace: **lead2-demo**. Demo password: **Lead2-Demo-2026!**.

| Sign-in page         | Email                 | Role                        |
| -------------------- | --------------------- | --------------------------- |
| `/login`             | `admin@lead2.demo`    | Client Super Admin          |
| `/login`             | `manager@lead2.demo`  | Client Manager, first team  |
| `/login`             | `manager2@lead2.demo` | Client Manager, second team |
| `/login`             | `sales@lead2.demo`    | Sales Team Member           |
| `/super-admin/login` | `engineer@lead2.demo` | Lead2 Engineer              |
| `/super-admin/login` | `ops@lead2.demo`      | Lead2 Approver / Ops        |

The demo includes example customers, multiple teams, a pipeline, follow-up tasks, a commercial catalog, and a standard proposal template. No external mail, AI, payment, or CRM service is required to try the implemented workflows.

## Run with persistent PostgreSQL using Docker

Requirements: Docker Engine/Desktop with Docker Compose v2 or newer; Bash for the helper scripts (WSL or Git Bash on Windows).

```bash
bash scripts/generate-env.sh
docker compose up -d --build --wait
bash scripts/bootstrap-engineer.sh
```

The generator creates random application secrets. Engineer setup prompts for a name, email and password; it does not print the password or store it in source. A second engineer requires explicit operator use of `--additional`. There is no public engineer setup API.

Open **http://localhost:3000/super-admin/login** and sign in as the engineer. Use **Lead2 team → Add Ops member** to provision an Ops account.

For a new client:

1. The client requests a new workspace at `/register`.
2. An Ops member reviews the request, enters an agreement reference and licensed seats, and approves it.
3. The requester signs in through `/login` and becomes the Client Super Admin.
4. The super admin adds managers and sales members, sets reporting lines, configures authority and commercials, then begins work.

Client join requests are reviewed by that client's super admin, subject to available seats. Lead2 Ops does not approve individual client joins.

The local Compose file binds ports 3000, 4000 and 5432 to localhost. PostgreSQL data persists in the `pgdata` volume. **Do not use `docker compose down -v` on an installation whose data must be retained.**

## Client administration and user handover

Use **Team & access**:

- Add or edit users, change a client role, assign a manager, reset a password, or reactivate an inactive account.
- New and reset passwords require a change on next sign-in.
- **Remove & replace** deactivates a user, immediately revokes their session, and transfers their leads, open tasks and proposal ownership to an existing or newly created replacement.
- A replacement can be created even when the license is full, because deactivation and creation share one database transaction.
- Historical authorship and activities remain intact. If the departing user manages people, the form also selects their new reporting manager.
- The last active Client Super Admin cannot be removed or demoted. Reporting cycles and cross-workspace relationships are rejected.
- Managers can organize subordinate reporting lines within their own tree. A manager cannot move themselves, change a super admin, or move a user outside their accessible team.

The super admin configures role permissions and commercial authority in **Authority matrix**. Managers may set lower limits for reportees, bounded by both the reportee's role and the manager's own authority. Data visibility remains fixed to own records / reporting tree / whole client workspace.

Default self-authorized discounts are 10% for sales members and managers, and 100% for super admins. Managers may approve another user's proposal up to 25% discount and a total of 1,000,000 in the proposal's currency. These limits are configurable. Limits use the numeric amount in each proposal currency; there is no foreign-exchange conversion.

## Commercials and proposal templates

A super admin can create multiple **Commercial catalogs** with products/services, units, prices, currency, tax and payment terms. Supported proposal currencies are INR, USD, EUR, GBP, AED, SGD, AUD and CAD, with two-decimal calculation. Lead dashboards use the workspace base currency set during onboarding; proposal currencies are not combined into a misleading total.

Template uploads accept **DOCX, HTML, TXT and Markdown**, up to 2 MB. DOCX archive contents are bounded to 10 MB expanded and 300 members. DOCX text and tables are imported; complex Word pagination, embedded images, and exact layout fidelity are not preserved. HTML is sanitized. Scripts, remote images and active content are removed.

Include `{{commercial_table}}` in the standard format. Available placeholders include:

```text
{{proposal_title}} {{proposal_number}} {{proposal_date}} {{valid_until}}
{{client_name}} {{company_name}} {{seller_name}}
{{commercial_table}} {{subtotal}} {{discount}} {{tax}} {{total}}
{{currency}} {{terms}}
```

Add up to 12 questions with unique keys, for example `scope` and `timeline`, and include their placeholders (`{{scope}}`, `{{timeline}}`) in the template. Download a starting format from `apps/web/public/sample-proposal-template.html` or from the template screen.

The guided proposal flow asks for the lead, catalog, template, quantities, answers, discount and validity. Prices and tax come from the saved catalog. The server calculates totals using decimal arithmetic and preserves a snapshot of the catalog, template and answers.

A discount above the creator's authority enters **Awaiting approval**. Another authorized manager in the reporting chain or a super admin must approve it. A manager cannot approve their own proposal or exceed their approval limits. Pending and rejected proposals cannot be marked sent, and the API rejects attempts to bypass that state machine.

Proposals have an HTML preview and download. **Open / print PDF** opens the document for the browser's **Print → Save as PDF**. This is browser printing, not a server PDF service. “Mark sent” records an external handoff; it does not send email. Revisions are generated as new proposals so earlier snapshots remain intact.

## Core CRM features

- Lead creation, search, page-by-page listing, CSV import and export of the current page.
- Duplicate contact checks without revealing another team's contact details.
- Encrypted lead phone/email fields with tenant-scoped duplicate hashes.
- Configurable pipelines, stages, win probabilities, outcomes and required entry fields.
- Drag-and-drop board and a keyboard-accessible stage selector on lead detail.
- Lead age, stage age, stage history, notes/calls/email/meeting activity, tasks and reminders shown in-app.
- Scoped sales dashboards, weighted forecasts, source and owner performance.
- Bulk lead reassignment, with related proposal ownership and matching open tasks transferred.
- Workspace and platform audit views.
- Session cookies are HttpOnly. Role, account, password-version and workspace status are rechecked for every authenticated request.
- No authenticated API responses are cached by the service worker.

List limits are explicit: the Leads page supports pagination; the board, tasks and proposals display up to 500 records, and audit screens display the latest 200 events. Recurring notification delivery, large-scale analytics and background escalations are future work.

## Upgrade the uploaded v2 installation

**Preserve the existing database volume and all encryption/hash keys.** Back up before upgrading. See `docs/MIGRATION.md` for the detailed sequence.

If the original folder/project was named `perpetual-crm`, keep its Compose project name when deploying the renamed source:

```bash
export COMPOSE_PROJECT_NAME=perpetual-crm
# Copy the ORIGINAL .env into this source checkout, then add the new settings.
bash scripts/backup.sh
bash scripts/migrate-existing.sh
docker compose up -d --build --wait
```

For AWS, also set `COMPOSE_FILE=docker-compose.aws.yml`. Do not generate replacement encryption keys for an existing database.

The migration maps original platform super admins to Lead2 Engineers, Org Admin to Client Super Admin, Manager to Client Manager, and Sales Executive to Sales Team Member. Existing client seat limits are initialized to at least the current active-user count. Ops should then record the actual commercial agreement. Existing leads, users, pipelines, activities and proposals are preserved.

All users must sign in again because authentication changed from local-storage tokens to cookies. Old managers who formerly saw the entire client now see only their reporting tree. Configure reporting lines, commercials and templates before rollout.

## Public HTTPS / AWS starter

The AWS starter is a single-host deployment, not high availability. It includes private container networking, persistent PostgreSQL, encrypted EC2 storage, restricted SSH and a Caddy HTTPS edge. Use the release gates in `SECURITY.md` before real customer deployment.

Terraform files are in `infra/aws-ec2`. Supply your existing EC2 key pair and a restricted administrator CIDR. Install Docker Compose using the [official Docker plugin instructions](https://docs.docker.com/compose/install/linux/) after host provisioning. The Terraform starter deliberately does not run a downloaded installation script as root.

On the host, put the source in `/opt/lead2-crm`, generate `.env`, and set:

```dotenv
SITE_ADDRESS=crm.example.com
CORS_ORIGIN=https://crm.example.com
COOKIE_SECURE=true
```

Point DNS to the host and allow ports 80 and 443. Caddy obtains certificates for the configured public domain; see [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https). Then run:

```bash
bash scripts/aws-start.sh
COMPOSE_FILE=docker-compose.aws.yml bash scripts/bootstrap-engineer.sh
```

`aws-start.sh` builds, starts PostgreSQL, makes a database backup, runs the transactional schema upgrade and starts the application. Retain backups off-host and test restoration. It never overwrites an existing `.env`.

The optional GitHub **Deploy EC2** workflow is manual, runs tests/build plus a production dependency-audit gate, and uses the `production` environment. It requires `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`, and independently verified `EC2_KNOWN_HOSTS` secrets. Prepare `/opt/lead2-crm/.env` on the server first. The dependency-audit gate will block this release until the remaining inherited advisory chain is upgraded.

## Upload this package to GitHub

**Extract the ZIP and upload/commit the files inside `lead2-crm`; uploading the ZIP alone does not create a runnable source repository.** Include `.github`, `.gitignore`, `.dockerignore` and `package-lock.json`.

```bash
cd lead2-crm
git init
git add .
git commit -m "Lead2 CRM v3: five roles, seats, teams and guided proposals"
git branch -M main
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```

Never commit `.env`, real customer exports, database backups, private keys or Terraform state. CI installs the lockfile, type-checks, tests and builds. Public deployment is a separate manual workflow.

## Developer verification

```bash
npm ci
npm run lint
npm test
npm run test:integration
npm run build
```

The integration harness runs the real NestJS routes against PGlite using the `crm_app` database role and PostgreSQL row-level security. It checks permission boundaries, seat limits, handovers, approvals and data isolation. PGlite serializes transactions; production PostgreSQL concurrency/load and Docker-host checks remain deployment gates.

Run `npm run demo` for a working acceptance-test environment. A manual acceptance checklist is included in `docs/ACCEPTANCE_TESTS.md`. Exact checks completed for this archive are recorded in `BUILD_REPORT.md`.

## What remains beyond this release

Enterprise SSO/MFA, self-service email verification/recovery, Gmail/Outlook/WhatsApp/calendar/telephony integrations, mail delivery, workflow automation workers, recurring notifications, e-signatures, large-scale reporting, import migration tools for other CRMs, multilingual UI, object storage, high availability, full browser/accessibility/load testing and a formal independent security review are not included. The original aspirational brief is retained in `docs/REFERENCE_PRODUCT_BRIEF.md` for future planning.
