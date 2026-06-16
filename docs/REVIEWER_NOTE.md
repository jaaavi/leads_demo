# Reviewer Note

This repository is a public, anonymized demo of a real application that has a production deployment for a client. The demo keeps the technical structure of the project, but replaces the production runtime with mock data so it can be published without private data, credentials, or a database.

## 3-Line Answer

```text
LeadOps is a production-style CRM/prospecting dashboard for finding local businesses, converting discovered places into leads, assigning follow-ups, tracking funnel stages, and reviewing sales performance. Demo: <LIVE_DEMO_URL> Repo: <REPO_URL>
My role: I designed and built the full-stack Express/EJS app structure, including auth/roles, lead/place workflows, admin panels, stats, funnel flows, and the Vercel-ready public demo.
Hardest technical decision: preserving the production-like MySQL architecture while making the public version run safely on mock APIs only, so reviewers can inspect the real structure without exposing client data or requiring a database.
```

## Context

The real version is designed for:

- MySQL.
- Persistent sessions.
- User roles.
- Place and lead management.
- Commercial funnel tracking.
- Statistics.
- External integrations.

The public version:

- Uses `routes/demo.js`.
- Uses `db/demoData.js`.
- Disables `db/config.js` and `db/localdata.js`.
- Does not run migrations or external services.
- Does not contain real client data.

## What To Review

To understand the project quickly:

1. Start with `/places`.
2. Convert a place into a lead.
3. Review `/leads` for commercial workflow management.
4. Review `/stats` for performance summaries.
5. Open `routes/demo.js`, `db/demoData.js`, `controllers/`, and `models/` to compare the demo layer with the preserved production-style structure.
