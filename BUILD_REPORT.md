# Lead2 CRM v3 — verification report

Release source: Lead2 CRM 3.0.0, based on the supplied Perpetual CRM v2 archive.

## Passed

- Backend and frontend TypeScript checks.
- 7 unit tests, including commercial calculations and bounded DOCX ZIP validation.
- 16 integration tests covering five-role authorization, reporting scope, tenant isolation, seats, user replacement, proposals, approvals, sessions and suspension.
- NestJS production compilation.
- Next.js optimized production compilation and route generation.

Integration tests run against PGlite's PostgreSQL engine. They do not establish real PostgreSQL multi-connection concurrency or deployment performance.

The frontend build required a local verification-only shim for unavailable host memory/network statistics in the restricted sandbox. That shim is not included or required in the application source.

## Not verified in this environment

- Browser interaction, screenshots, accessibility or mobile device acceptance: browser launch was blocked by the execution environment. Follow `docs/ACCEPTANCE_TESTS.md`.
- Docker image execution, real PostgreSQL deployment and backup/restore, Terraform execution, AWS deployment and live HTTPS.
- Salesforce/HubSpot feature parity, production load, external integrations and enterprise compliance.

## Dependency status

An initial audit identified high-severity ZIP and multipart dependencies. The direct vulnerable ZIP dependency was removed; bounded native ZIP validation is tested. The inherited NestJS/Multer advisory chain remains in the tested lockfile. Multipart requests are rejected before routing, but a compatible dependency upgrade and clean audit remain production release gates. The manual deployment workflow enforces the high-severity audit gate. See `SECURITY.md` for details.

This archive is a functional pilot source release. Complete the documented security, browser and deployment gates before public production use.
