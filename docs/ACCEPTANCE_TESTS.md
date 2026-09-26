# Browser and deployment acceptance checklist

Run `npm ci && npm run demo` for a disposable acceptance environment. These manual browser checks are release gates; they were not completed in the restricted build sandbox.

1. **Client login and navigation:** sign in as `admin@lead2.demo` in `lead2-demo`; visit Overview, Leads, Pipeline, Tasks, Proposals, Team & access, Commercials and Workspace settings. Check error handling and empty states.
2. **Lead lifecycle:** create a lead, edit its contacts, add an activity, move stages with the selector and by dragging, and confirm ageing/history and dashboard totals. Test required stage fields and duplicates.
3. **Team isolation:** compare the two manager demo accounts and the sales account. Confirm records, tasks, proposal documents, dashboards and user lists follow the reporting tree. Test keyboard navigation as well as clicking.
4. **Seats and handover:** reach a seat limit, verify additional creation is blocked, then remove and replace a user at capacity. Check lead/task/proposal ownership and reportee reassignment. Verify the removed user cannot use their old session.
5. **Authority:** configure manager limits; apply a lower member override. Confirm no self-escalation, cross-team assignment, hierarchy cycle or last-super-admin removal is allowed.
6. **Proposal generation:** create/edit a commercial and upload a standard HTML or DOCX template with `{{commercial_table}}`, `{{scope}}` and `{{timeline}}`. Generate a proposal using the wizard. Verify server totals, answers, HTML preview, download and browser print-to-PDF.
7. **Approval:** request a discount beyond a salesperson's limit. Confirm sending is blocked, another qualified manager can approve it, self-approval fails, and rejected proposals cannot be marked sent. Changing catalog prices must not change an existing proposal snapshot.
8. **Ops and engineer:** approve a new workspace with seats, reject a request, amend an agreement, test reduction below usage, suspend/re-enable a client. Confirm only engineers can open client CRM workspaces and provision Ops accounts.
9. **Password handling:** new client users must change temporary passwords; verify reset, logout and password changes revoke prior sessions. Check the platform change-password dialog too.
10. **Responsive/accessibility:** test at 390 px and desktop widths. Verify navigation, readable fields, dialogs, focus/escape behavior, tables, color contrast and screen-reader labels. The pipeline's internal horizontal scroll is intentional.
11. **Deployment:** build both Docker images on the target host, apply the migration twice on a restored v2 database, test competing database connections, verify HTTPS/cookies, check rate limiting, and rehearse backup restoration.
12. **Dependency gate:** resolve the inherited multipart dependency advisories and pass the production audit before using the public deployment workflow.
