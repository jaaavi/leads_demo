# LeadOps Leads Dashboard Demo

Public demo of a lead prospecting dashboard for discovering local business opportunities, converting them into leads, and managing commercial follow-up.

This repository is an anonymized public demo of an application that has a real production version for a client. The production version is designed around MySQL, persistent sessions, external integrations, and private operational data. This public version is designed to show the product and its architecture without exposing client data, credentials, or private infrastructure.

The repository keeps the full shape of a real Express/EJS application (`controllers`, `models`, `middleware`, `services`, `scripts`, migrations, and views), while the public runtime is isolated and powered only by in-memory mock data.

## For Reviewers

**What it does:** LeadOps is a production-style CRM/prospecting dashboard for finding local businesses, turning discovered places into leads, assigning follow-ups, tracking funnel stages, and reviewing sales performance.

**My role:** I designed and built the full-stack Express/EJS application structure, including auth/roles, lead and place workflows, admin panels, stats, funnel flows, and a safe public demo layer for Vercel.

**Hardest technical decision:** preserving the real production-like project structure while making the public demo run only on mock data, with disabled DB adapters and no secrets, so reviewers can inspect the architecture without requiring MySQL or exposing client data.

## What It Shows

- Search and opportunity-generation dashboard.
- Places discovered through Google Maps-style prospecting.
- Lead management with filters, assignment, statuses, and action history.
- Sales statistics and funnel reporting.
- Follow-up calendar.
- Simulated WhatsApp panel.
- Message strategies.
- Admin tools and administration screens.
- Internal documentation for roles and workflows.

## Safe Public Demo

The demo does not connect to a database and does not require external credentials.

- Mock data lives in [`db/demoData.js`](db/demoData.js).
- Public demo routes live in [`routes/demo.js`](routes/demo.js).
- The Vercel serverless entrypoint is [`api/index.js`](api/index.js).
- `db/config.js` and `db/localdata.js` are intentionally disabled to prevent accidental MySQL connections.
- The real application structure is preserved for technical review, but it is not the active Vercel runtime.

The real implementation is designed for MySQL, persistent sessions, external services, and migrations. In this public repository that production-oriented layer is kept as visible architecture, not as active runtime.

## Suggested Walkthrough

1. Open `/places` to inspect discovered businesses and filters.
2. Convert a place into a lead.
3. Open `/leads` to manage status, assignment, and actions.
4. Open `/stats` to review commercial performance and funnel data.
5. Open `/admin/strategies` to inspect message strategy configuration.

## Stack

- Node.js
- Express
- EJS
- Bootstrap
- Vercel Serverless Functions
- In-memory mock data

## Project Structure

```text
.
├── api/                  # Vercel serverless entrypoint
├── controllers/          # Controllers from the production-style implementation
├── db/                   # Mock data, DB stubs, and real migrations
├── middleware/           # Auth and role middleware
├── migrations/           # Historical SQL migrations
├── models/               # Data models from the production-style implementation
├── routes/               # Real routes and demo routes
├── scripts/              # Operational and migration scripts
├── server/               # Local startup compatible with the demo
├── services/             # External-service integrations from the real architecture
├── utils/                # Shared utilities
├── views/                # EJS views
├── vercel.json           # Vercel rewrites
└── docs/                 # Demo documentation
```

## Run Locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:4080
```

The demo automatically creates a session as `demo_admin`. You can also submit `demo_comercial` in the login form to simulate a `comercial_pro` user. The password is not validated because there are no real users or database records in the public demo.

## Deploy to Vercel

1. Push this folder as a new repository.
2. Import the repository in Vercel.
3. Framework preset: `Other`.
4. Build command: leave empty.
5. Output directory: leave empty.
6. Install command: `npm install`.

Optional environment variable:

```text
SESSION_SECRET=<long-random-string>
```

Vercel routes all requests to `api/index.js` through [`vercel.json`](vercel.json).

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Demo mode and mock data](docs/DEMO_MODE.md)
- [Demo API](docs/API.md)
- [Vercel deployment](docs/VERCEL_DEPLOY.md)
- [Security and publication checklist](docs/SECURITY.md)
- [Reviewer note](docs/REVIEWER_NOTE.md)

Operational documents from the production-style project are also included:

- [Authentication and roles](AUTH_README.md)
- [Environment setup](ENV_SETUP.md)
- [Linux installation](INSTALL_LINUX.md)
- [Tools setup](TOOLS_SETUP.md)

## Public Repository Notes

This repository must not contain `.env` files, sessions, API keys, MySQL credentials, or real client data. `.env.example` is a sanitized template.

`node_modules/` and `.vercel/` are ignored by Git.

## License

Technical demo for product presentation. Define a license before allowing public reuse of the code.
