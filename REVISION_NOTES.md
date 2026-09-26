# Lead2 CRM v3 changes

Both uploaded v2 ZIPs contained identical application source; the second also contained extra wrapper documents. The shared application source was used as the baseline.

- Rebranded the product, package names, UI, manifests, scripts and infrastructure to Lead2 CRM.
- Split the platform administrator into code-provisioned Engineer and limited Approver/Ops roles.
- Added seat limits and commercial agreements; serialized seat-consuming writes with tenant-row locks.
- Replaced whole-client manager access with recursive reporting-tree scope across CRM records and dashboards.
- Added role edits, reporting management, authority limits, session revocation and atomic user replacement.
- Added commercial catalogs, document templates, custom questions and guided proposal generation.
- Replaced bypassable proposal statuses with permission-checked transitions and independent approval.
- Rebuilt the connected frontend around the new workflows.
- Fixed inherited dashboard SQL errors and hardened activity/task/proposal authorization.
- Replaced browser-local JWT storage with HttpOnly cookies and removed authenticated service-worker caching.
- Added bounded document inspection, removed the vulnerable direct ZIP dependency, and rejected multipart requests.
- Added integration tests and an isolated, disposable demo using the same API and RLS schema.
- Updated Docker build contexts, Node version, migration/backup scripts, GitHub workflows and AWS HTTPS configuration.

See BUILD_REPORT.md for what was executed and SECURITY.md for the remaining dependency and production gates.
