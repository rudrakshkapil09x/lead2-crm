# Historical product brief

This reference came with the uploaded v2 source. It includes aspirational scope; use README.md and PRODUCT_SPEC.md for the v3 implementation boundary.

**Perpatual
Sales CRM — High-Level Product Feature Guide**

**0.
Positioning Statement**

A
multi-tenant sales CRM that combines **enterprise-grade security and
configurability** (like Salesforce) with **consumer-grade simplicity**
(like WhatsApp/Facebook). The core bet: every screen should be usable by a
field sales rep with zero training, while admins get deep customization behind
the scenes.

---

**1.
UX/UI Design Principles**

·       
**3-tap rule**: any core action (add lead, log call,
update stage, send message) completable in 3 taps or fewer.

·       
**Chat-first interface**: a WhatsApp-style feed/timeline
per lead — messages, calls, notes, and stage changes appear as a scrollable
conversation thread, not buried in tabs.

·       
**One primary action per screen** — avoid
Salesforce's "20 buttons on one page" problem.

·       
**Mobile-first, offline-capable**: full
functionality on mobile with local caching; syncs when back online (critical
for field sales).

·       
**Minimal-click data entry**: smart defaults,
auto-fill, voice-to-text notes, single-screen forms instead of multi-tab record
pages.

·       
**Consistent card-based UI**: leads/deals as
swipeable cards (swipe right = advance stage, swipe left = reassign/disqualify)
— Tinder-like interaction for pipeline triage.

·       
**Dark mode + accessibility** as standard, not
an afterthought.

·       
**In-app onboarding via tooltips/checklists**, not lengthy
manuals.

---

**2.
Multi-Tenant Architecture & Confidentiality**

·       
**True multi-tenancy**: single codebase/infrastructure,
logically isolated tenant data (separate schema or row-level security with
tenant\_id partitioning).

·       
**Data isolation guarantees**: no cross-tenant
query paths even at the API layer; encrypted at rest (AES-256) and in transit
(TLS 1.3).

·       
**Tenant-level customization without code forks**: each tenant
configures their own pipeline, fields, roles, and workflows via admin UI — not
custom deployments.

·       
**Compliance-ready**: GDPR/DPDP (India) consent
tracking, data residency options, audit logs, right-to-be-forgotten workflows.

·       
**Field-level encryption** for sensitive
data (phone, email, financial info) with tenant-controlled masking rules.

·       
**Session security**: device-based login approval, IP
allow-listing (optional per tenant), 2FA/SSO (Google, Microsoft, SAML).

·       
**Data export/backup ownership**: tenants can
export their full dataset anytime (avoids lock-in — a genuine differentiator
vs. incumbents).

---

**3.
Configurable Sales Pipeline Engine**

This
is a core differentiator — pipelines should be **built by tenants, not by your
dev team**.

·       
**Custom pipeline builder (drag-and-drop)**: each tenant
defines their own stages (e.g., New → Contacted → Qualified → Proposal →
Negotiation → Won/Lost) — unlimited pipelines per tenant (e.g., different
pipelines for different product lines/regions).

·       
**Per-stage configuration**:

o   Custom name,
color, order

o   **Conversion
probability %**
per stage (used for weighted pipeline forecasting)

o   Required
fields/checklist before a lead can move to that stage

o   Auto-actions on
entry (e.g., send email, assign task, notify manager)

·       
**Custom workflow/automation builder**: "If X
happens → then do Y" (no-code rule engine) — e.g., "If lead sits in
'Proposal' > 5 days → alert manager."

·       
**Multiple pipeline types**: Sales pipeline,
renewal pipeline, upsell pipeline — tenant chooses which applies to which
lead/product.

·       
**Weighted forecast dashboard**: auto-calculated
from stage × probability × deal value.

---

**4.
Lead Capture & Data Entry**

·       
**Camera-to-lead (OCR)**: snap a photo of a business card
or visiting card → auto-extracts name, phone, email, company via OCR +
auto-creates a lead record for review.

·       
**Bulk upload via Excel/CSV**: template-based
upload with column mapping UI (map "Mobile No." → phone field, etc.),
validation preview before import.

·       
**Duplicate detection engine**:

o   Fuzzy matching on
phone number, email, and name+company combination (not just exact match)

o   Configurable match
rules per tenant (e.g., phone-only match vs. phone+email)

o   On duplicate:
option to **merge, skip, or create-as-linked** (e.g., new opportunity under
existing contact)

·       
**Web form / landing page capture**: embeddable
lead-capture forms feeding directly into the pipeline (with UTM/source
tracking).

·       
**Manual quick-add**: single floating "+"
button, minimal required fields (name + phone), rest optional/enrichable later.

·       
**Data enrichment (optional add-on)**: auto-fill
company details from email domain, LinkedIn lookup, etc.

---

**5.
Access Control & Authority Matrix**

·       
**Role hierarchy**: Org Admin → Regional/Team Manager → Team
Lead → Sales Executive (fully customizable hierarchy depth per tenant).

·       
**Assignment-based visibility**: users see only
leads/deals assigned to them or their downline (configurable "see
own" vs "see team" vs "see all").

·       
**Field-level & action-level permissions**: e.g., only
managers can edit deal value or delete a lead; reps can only update
status/notes.

·       
**Territory/region-based access rules**: auto-assign
leads by geography, product line, or round-robin.

·       
**Approval workflows**: e.g., discounts above X% or deals
above ₹Y require manager approval before moving to "Won."

·       
**Delegate/OOO access**: temporary reassignment when a rep
is on leave.

·       
**Full audit trail**: who viewed/edited/reassigned what
and when (critical for confidentiality + compliance).

---

**6.
Lead → Opportunity → Business Conversion Tracking**

·       
**Unified lead lifecycle**: Lead → Qualified
Lead → Opportunity → Won (Customer) / Lost, with reason codes captured at every
drop-off (critical for funnel analysis).

·       
**Activity timeline per lead**: calls, emails,
meetings, notes, stage changes — single chronological feed.

·       
**Conversion analytics**: stage-wise drop-off rates,
average time-in-stage, source-wise conversion %, rep-wise conversion %.

·       
**Lost-reason tracking** with custom tenant-defined reason
lists (for pattern analysis — e.g., "price," "competitor,"
"no budget").

·       
**Deal value & revenue tracking**: quote-to-close
tracking, linked to actual invoicing/revenue if integrated with billing tools.

·       
**Customer handoff workflow**: on
"Won," auto-trigger handoff to onboarding/success team with all deal
context.

---

**7.
Reminders, Meetings & Scheduling**

·       
**Smart reminders**: auto-generated follow-up reminders based
on stage/inactivity rules (e.g., "no activity in 3 days → reminder to
rep").

·       
**Manual task/reminder creation**: with recurrence
options (daily/weekly/custom).

·       
**Meeting scheduler**:

o   Native calendar
view (day/week/month) with drag-to-reschedule

o   **Two-way calendar
sync**
(Google Calendar, Outlook)

o   Shareable booking
links (like Calendly) for prospects to self-book slots

o   Auto-generated
video meeting links (Zoom/Google Meet/Teams integration)

·       
**Push/SMS/WhatsApp/email notification options** per reminder
(tenant/user configurable).

·       
**Missed-follow-up escalation**: auto-notify
manager if a rep misses a scheduled task beyond X hours.

---

**8.
Communication & Mail Integration**

·       
**Two-way email sync**: Gmail/Outlook integration —
emails to/from a lead auto-log into their timeline (no manual BCC needed).

·       
**Email templates & sequences**: pre-built
templates, mail-merge fields, basic drip sequences with open/click tracking.

·       
**WhatsApp Business API integration**: send/receive
WhatsApp messages directly from the CRM (huge differentiator for India/APAC
markets vs. SF/HubSpot).

·       
**Click-to-call + call logging**: integrated
dialer (via Twilio/Exotel-type providers) with auto call recording and logging.

·       
**Unified inbox**: all channels (email, WhatsApp, SMS, call
logs) in one thread per lead — this is the "better than Salesforce"
UX moment.

---

**9.
Reporting, Dashboards & Forecasting**

·       
**Role-based dashboards**: rep sees
personal targets/pipeline; manager sees team rollup; admin sees org-wide.

·       
**Drag-and-drop custom report builder** (no SQL/technical
knowledge needed).

·       
**Pre-built templates**: funnel report, source-wise ROI,
rep leaderboard, forecast vs. actual, stage-velocity report.

·       
**Real-time weighted forecasting** using stage
probability × deal value.

·       
**Exportable + scheduled reports** (auto-email
weekly PDF/Excel summary to leadership).

---

**10.
Platform & Integration Ecosystem**

·       
**Open API + Webhooks** for custom integrations.

·       
**Native integrations**: WhatsApp Business, Gmail/Outlook,
Google Calendar, Zoom/Meet, Excel/Google Sheets, Tally/QuickBooks (for Indian
SMB market), Zapier/Make for long-tail integrations.

·       
**Marketplace/App-store model** (future): allow
third-party or tenant-built extensions — long-term Salesforce-AppExchange-style
moat.

·       
**Import/export freedom**: no lock-in; full
data portability builds trust vs. incumbents.

---

**11.
Auto Proposal Preparation & Sales Collateral Library**

A
high-leverage feature — turns proposal creation from a 1–2 hour manual task
into a 2-minute guided form for the sales rep.

**11.1
Admin-Side Proposal Template Builder**

·       
**Master template setup (per tenant, or per product
line/region)**:
admin defines a reusable proposal structure once —

o   **Service/product
catalog**:
list of sellable services/products with descriptions, default pricing, and
units (per-hour, per-project, per-seat, etc.)

o   **Pricing rules**: base price,
tiered pricing (volume-based), currency, tax/GST rules

o   **Discount matrix**: admin sets
allowable discount bands (e.g., 0–10% auto-approved, 10–20% needs manager
approval, >20% needs admin approval) — ties into the approval workflow in
Section 5

o   **Standard terms
& conditions library**: pre-approved legal/commercial clauses (payment
terms, validity period, delivery timelines, cancellation policy) — admin can
maintain multiple T&C sets (e.g., domestic vs. international clients)

o   **Branding elements**: logo, color
scheme, letterhead, signature block — auto-applied to every proposal

·       
**Conditional logic in templates**: admin can
configure which questions/sections appear based on earlier answers (e.g.,
selecting "Enterprise plan" auto-hides SMB pricing options).

·       
**Version control**: admin can update master pricing/terms
centrally — old proposals stay locked to the version used, but new ones use the
latest.

**11.2
Sales Rep-Side Proposal Generation Flow**

·       
**Guided Q&A wizard** (not a blank
document): rep answers a short set of admin-defined questions, e.g.:

1.     
Which
service(s)/product(s) is the client interested in? (multi-select from catalog)

2.     
Quantity
/ scope / duration

3.     
Any
discount to apply? (bounded by admin-set matrix; auto-routes for approval if
exceeded)

4.     
Which
T&C set applies?

5.     
Client
name, contact, and any custom notes/scope description

·       
**Auto-generated commercial proposal**: system compiles
the answers into a branded, ready-to-send PDF/DOCX — pricing table, discount
reflected, terms attached, no manual formatting by the rep.

·       
**Auto-calculation engine**: totals, taxes,
and discounted values computed automatically — eliminates manual pricing
errors.

·       
**Editable before sending**: rep can
fine-tune wording in a locked/guided editor (structure and legal terms stay
protected; only specific fields are editable, depending on permission level).

·       
**One-click send**: email directly to the client from within
the CRM (logged automatically to the lead's activity timeline) or download as
PDF.

·       
**Proposal tracking**: know when the client
opened/viewed the proposal (like email tracking) — feeds back into the lead
timeline and can trigger a follow-up reminder.

·       
**Approval-in-the-loop**: if a discount or term falls
outside pre-approved bounds, proposal routes to manager/admin for one-click
approval before it can be sent.

**11.3
Company Presentation (PPT) Library**

·       
**Admin-managed PPT repository**: admin uploads up
to a defined limit (e.g., **up to 3 standard company/product PPTs**) — could
be role-based (e.g., different decks for different products, industries, or
regions).

·       
**Sales rep access**: reps can **view, download, and
directly share** (via email/WhatsApp/link) the latest approved company
deck(s) with a customer — no need to search shared drives or ask marketing for
the "latest version."

·       
**Always-current guarantee**: when admin
replaces/updates a deck, it's instantly reflected for all reps — prevents
outdated decks from circulating.

·       
**Usage tracking**: log which rep shared which deck with
which client and when (visibility for marketing/sales ops on collateral usage).

·       
**Optional tenant-level expansion**: allow more than
3 if a tenant's plan/tier permits — keep 3 as the default/standard tier limit,
configurable per subscription plan.

---

**12.
AI-Native Differentiators (where you can genuinely beat SF/HubSpot)**

·       
**AI lead scoring**: auto-rank leads by likelihood to convert
based on historical patterns.

·       
**AI-drafted follow-up emails/WhatsApp replies** based on
conversation context.

·       
**Voice-note-to-CRM**: rep speaks a quick update after a
client meeting → auto-transcribed and auto-filed into the right fields/notes.

·       
**Next-best-action suggestions**: "This lead
hasn't been contacted in 4 days — call now" style nudges, contextual not
generic.

·       
**Anomaly alerts**: flag deals stuck too long, reps with
unusually low activity, sudden pipeline drop-offs.

---

**13.
Suggested Build Phasing**

|     |
| --- |

**Phase**

|     |
| --- |

**Focus**

|     |
| --- |

**MVP**

|     |
| --- |

Multi-tenant
&#x20; core, custom pipeline builder, manual + Excel lead entry, duplicate
&#x20; detection, basic role/access matrix, reminders, mobile-first UI

|     |
| --- |

**V2**

|     |
| --- |

Camera/OCR
&#x20; lead capture, email + WhatsApp integration, meeting scheduler, reporting
&#x20; dashboards, approval workflows, auto proposal builder (basic), PPT library

|     |
| --- |

**V3**

|     |
| --- |

AI
&#x20; lead scoring, AI drafting, marketplace/integrations ecosystem, advanced
&#x20; forecasting, voice-to-CRM, proposal auto-personalization via AI

---

**14.
Key Success Metrics to Design Around**

·       
Time-to-first-lead-entry
(target: under 15 seconds)

·       
%
of reps using mobile app daily (adoption is where SF/HubSpot struggle in SMB)

·       
Duplicate
rate post-import (should trend near 0%)

·       
Average
clicks to close a deal stage update (target: 1–2)

\---

\# PART B: TECHNOLOGY ARCHITECTURE

\## B1. Guiding Principles for Stack Selection

\- \*\*Multi-tenant-first\*\*: every layer must support tenant isolation cleanly,
not be retrofitted later.

\- \*\*Boring where it counts, modern where it matters\*\*: proven tech for
data/infra layers; modern DX for frontend/mobile velocity.

\- \*\*Cloud-agnostic where feasible\*\*: avoid hard lock-in to one hyperscaler
given long product horizon.

\- \*\*API-first\*\*: every feature built as an API first, UI consumes it — enables
future mobile, integrations, and marketplace.

\## B2. Frontend Stack

\| Layer | Recommendation | Why |

\|---|---|---|

\| Web app framework | \*\*Next.js (React 18+) + TypeScript\*\* | SSR/SSG for fast
loads, huge ecosystem, strong hiring pool |

\| Styling | \*\*Tailwind CSS\*\* + a component library (shadcn/ui or Radix
primitives) | Rapid, consistent, themeable per-tenant branding |

\| State management | \*\*TanStack Query\*\* (server state) + \*\*Zustand\*\* (light
client state) | Avoids Redux boilerplate; great caching/sync for real-time
pipeline updates |

\| Mobile app | \*\*React Native (with Expo)\*\* | Single codebase for iOS/Android,
shares logic/types with web via a monorepo |

\| Offline support (mobile) | \*\*WatermelonDB\*\* or \*\*RxDB\*\* for local-first sync
\| Critical for field sales with poor connectivity |

\| Real-time updates | \*\*WebSockets via Socket.IO\*\* or \*\*Pusher/Ably (managed)\*\*
\| Live pipeline/card updates across users without polling |

\| Design system tooling | \*\*Storybook\*\* | Keeps the "simpler than
Salesforce" UI consistent as the team scales |

\> Alternative considered: \*\*Flutter\*\* for mobile — stronger single-codebase
performance, but React Native wins here for code/type sharing with the Next.js
web app via a shared monorepo (Turborepo/Nx).

\## B3. Backend Stack

\| Layer | Recommendation | Why |

\|---|---|---|

\| Primary API services | \*\*Node.js + NestJS (TypeScript)\*\* | Structured,
modular, DI-based — scales well across a growing microservice set; shares types
with frontend |

\| AI/ML & OCR services | \*\*Python + FastAPI\*\* | Best ecosystem for AI/ML,
OCR (Tesseract/Vision APIs), data science workloads |

\| API style | \*\*REST for CRUD + GraphQL (via Apollo/Federation) for aggregated
views\*\* | GraphQL suits dashboards pulling from multiple services in one call;
REST keeps simple CRUD simple |

\| Authentication & multi-tenant identity | \*\*Keycloak\*\* (self-hosted,
open-source) or \*\*Auth0/WorkOS\*\* (managed) | Handles SSO, per-tenant realms,
2FA, and social login out of the box |

\| Background jobs / async | \*\*BullMQ (Redis-backed)\*\* for lightweight jobs;
\*\*Apache Kafka\*\* for high-volume event streaming (activity feed, webhooks,
notifications) | Decouples slow work (email sending, OCR, report generation)
from request path |

\| File/OCR processing | \*\*Tesseract OCR\*\* (self-hosted) or \*\*Google Cloud
Vision / AWS Textract\*\* (managed, higher accuracy) | Card-scan feature depends
on OCR accuracy — managed API recommended for MVP, revisit self-hosted at scale
for cost |

\| Search & duplicate detection | \*\*OpenSearch (Elasticsearch fork)\*\* |
Fuzzy matching for duplicate lead detection, fast global search across tenant
data |

\## B4. Data Layer

\| Layer | Recommendation | Why |

\|---|---|---|

\| Primary database | \*\*PostgreSQL\*\* | Best-in-class relational integrity,
native \*\*Row-Level Security (RLS)\*\* for multi-tenant isolation, JSONB for
tenant-custom fields |

\| Multi-tenancy model | \*\*Shared database, shared schema + \`tenant\_id\` + RLS\*\*,
with option to move large tenants to \*\*schema-per-tenant\*\* for
enterprise/compliance-heavy customers | Balances cost efficiency (shared) with
strict isolation option (dedicated schema) for big accounts |

\| Caching | \*\*Redis\*\* | Session cache, rate limiting, hot pipeline data, BullMQ
queue backend |

\| Object storage | \*\*AWS S3 / Cloudflare R2 (S3-compatible)\*\* | Business card
images, uploaded Excel files, proposal PDFs, company PPTs |

\| Analytics/reporting store | \*\*ClickHouse\*\* (or Postgres read-replicas for
MVP) | Fast aggregate queries for forecasting/reporting dashboards without
hitting transactional DB |

\| Data warehouse (later) | \*\*Snowflake/BigQuery\*\* via ETL (Airbyte) | For
advanced BI/AI training data once scale demands it |

\## B5. Infrastructure, DevOps & Kubernetes

\| Layer | Recommendation | Why |

\|---|---|---|

\| Containerization | \*\*Docker\*\* for every service | Standard, portable across
environments |

\| Orchestration | \*\*Kubernetes (K8s)\*\* — managed via \*\*AWS EKS\*\*, \*\*GCP GKE\*\*,
or \*\*Azure AKS\*\* | Auto-scaling per-tenant load spikes, rolling deployments
with zero downtime, self-healing |

\| Package management on K8s | \*\*Helm charts\*\* per microservice | Repeatable,
versioned deployments across dev/staging/prod |

\| GitOps / CD | \*\*ArgoCD\*\* | Declarative, auditable deployments straight from
Git — strong fit for a compliance-conscious multi-tenant product |

\| CI | \*\*GitHub Actions\*\* (or GitLab CI) | Test/build/scan on every PR;
integrates cleanly with container registries |

\| Service mesh (post-MVP) | \*\*Istio or Linkerd\*\* | mTLS between services,
fine-grained traffic control — useful once you have 15+ microservices |

\| Infra as Code | \*\*Terraform\*\* | Reproducible cloud infra (VPCs, K8s clusters,
DBs) across environments |

\| Secrets management | \*\*HashiCorp Vault\*\* (or cloud-native: AWS Secrets
Manager) | Central, auditable secret storage — critical given the
confidentiality requirement |

\| API Gateway | \*\*Kong\*\* or cloud-native (AWS API Gateway) | Rate limiting,
per-tenant API key management, request routing |

\| CDN | \*\*Cloudflare\*\* | Static asset delivery, DDoS protection, WAF |

\| Monitoring & observability | \*\*Prometheus + Grafana\*\* (metrics), \*\*Loki
or ELK stack\*\* (logs), \*\*Jaeger/OpenTelemetry\*\* (tracing), \*\*Sentry\*\* (error
tracking) | Full observability stack purpose-built for K8s environments |

\| Load/scale testing | \*\*k6\*\* | Validate multi-tenant load isolation before
major releases |

\### Suggested High-Level Architecture Flow

\`\`\`

[Web/Mobile Clients]

        │

   [Cloudflare CDN/WAF]

        │

   [API Gateway (Kong)]

        │

 ┌──────┴────────────────────────┐

 │       
Kubernetes Cluster       │

 │ 
┌───────────┐ ┌─────────────┐ │

 │ 
│ NestJS API │ │ FastAPI ML/ │ │

 │ 
│ Services   │ │ OCR Service │
│

 │ 
└─────┬─────┘ └──────┬──────┘ │

 │       
│              │        │

 │ 
┌─────┴──────────────┴─────┐  │

 │ 
│   Kafka / BullMQ (async)  │  │

 │ 
└─────┬─────────────────────┘ 
│

 └────────┼────────────────────────┘

          │

 ┌────────┴─────────┬──────────────┬──────────────┐

 │ 
PostgreSQL (RLS) │ Redis Cache   │
OpenSearch    │

 └───────────────────┴──────────────┴──────────────┘

          │

 [S3-Compatible Object Storage: images,
PPTs, PDFs]

\`\`\`

\## B6. Third-Party Integrations Layer

\- \*\*WhatsApp Business Cloud API\*\* (Meta) — official, avoids the ban risk of
unofficial libraries.

\- \*\*Twilio / Exotel\*\* — click-to-call, call recording, SMS.

\- \*\*Google Workspace & Microsoft Graph APIs\*\* — email sync, calendar
sync.

\- \*\*Zoom/Google Meet APIs\*\* — auto-generated video meeting links.

\- \*\*Razorpay/Stripe\*\* — if you add billing/subscription management for tenants
themselves.

\- \*\*Zapier/Make (via public API + webhooks)\*\* — long-tail integrations without
you building each one.

\## B7. Security Checklist (Given Confidentiality Requirement)

\- RLS enforced at the database layer, \*\*not just application layer\*\* (defense
in depth).

\- Field-level encryption (AES-256) for PII fields (phone, email) using envelope
encryption (e.g., AWS KMS).

\- Mandatory audit logging of all read/write access to sensitive records, stored
immutably (e.g., append-only table or dedicated audit service).

\- Regular third-party penetration testing before enterprise sales conversations
(SOC 2 readiness matters for winning large accounts against
Salesforce/HubSpot).

\- Tenant-configurable IP allow-listing and session policies.

\## B8. Why This Stack vs. Alternatives

\- \*\*Why not a monolith?\*\* A modular monolith (NestJS with clear module
boundaries) is actually fine for MVP — recommend starting \*\*modular monolith →
extract microservices\*\* (pipeline engine, OCR/AI, notifications, proposal
generator) as load and team size grow. Avoids premature microservice
complexity.

\- \*\*Why Kubernetes now vs. later?\*\* If multi-tenant scaling and per-tenant
resource isolation are core to the pitch (as stated), K8s from day one avoids a
costly re-platforming later — but keep the cluster small/managed (EKS/GKE)
initially rather than building custom infra ops.

\- \*\*Why Postgres over a NoSQL-first approach?\*\* The domain (pipelines, roles,
approvals, relational lead/deal data) is inherently relational; Postgres +
JSONB gives relational integrity \*\*and\*\* flexibility for tenant-custom fields,
avoiding the need for two databases early on.

\---

\## Suggested Next Steps

1\. Lock the multi-tenant data model (RLS policy design) — this underpins
everything else.

2\. Build a clickable prototype (Figma) from these wireframes for early user
testing before writing frontend code.

3\. Stand up the modular monolith + Postgres + basic K8s cluster as the MVP
skeleton; add Kafka/OpenSearch only when volume justifies it.

 
