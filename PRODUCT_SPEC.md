# Lead2 CRM v3 — implemented scope

The source implements five distinct roles: Lead2 Engineer, Lead2 Approver / Ops, Client Super Admin, Client Manager, and Sales Team Member.

- Platform: operator-controlled engineer provisioning, Ops account management, workspace registration review, agreement records, licensed seats, suspension and audit events.
- Client administration: seat-aware creation/reactivation, client roles, reporting trees, cycle checks, temporary passwords, removal and replacement with transactional record handover.
- Authority: client role permissions, own/subtree/all-client data scope, discount and approval limits, bounded per-member overrides, within-team assignments.
- CRM: leads, duplicate safeguards, phone/email encryption, CSV import and page export, pipelines/stages/outcomes, stage requirements, ageing/history, activities, tasks and scoped dashboards.
- Commercials: multiple client catalogs, prices, quantities, currencies, taxes, terms, catalog versions and archive flags.
- Proposals: client-owned templates (DOCX/HTML/TXT/Markdown), bounded uploads, custom questions, guided generation, snapshots, approval gates, HTML export and browser print-to-PDF.
- Interface: responsive navigation, sales overview, pipeline board, lead details, task views, team controls, commercial/template editors and platform control center.
- Delivery: complete source, package lock, PostgreSQL upgrade migration, demo mode, tests, Docker, an AWS starter, CI and a gated manual deployment workflow.

The detailed operational behavior and boundaries are in README.md. Future scope from the uploaded brief is kept separately in docs/REFERENCE_PRODUCT_BRIEF.md. This is a functional pilot release with the production gates recorded in SECURITY.md.
