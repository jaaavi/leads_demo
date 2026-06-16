# Architecture

This repository keeps the shape of the real application while running an isolated demo layer.

The original application has a production version for a client. This public demo preserves the architecture for technical review, but replaces the production runtime with mock data and database stubs.

## Demo Runtime

The active runtime for local development and Vercel is:

```text
server.js
└── api/index.js
    └── routes/demo.js
        └── db/demoData.js
```

`api/index.js` configures Express, in-memory sessions, EJS, static files, and views. It then mounts `routes/demo.js`, which serves both pages and JSON APIs using mock data.

## Preserved Production-Style Runtime

The production-style structure is kept to show how the real implementation is organized:

- `routes/index.js`: real application routes.
- `controllers/`: HTTP logic grouped by domain.
- `models/`: MySQL-oriented data access.
- `middleware/`: authentication, roles, and access control.
- `services/`: external integrations.
- `db/migrations/` and `migrations/`: schema changes.
- `scripts/`: operational scripts and migration helpers.

Those files are intentionally not the main runtime path for the public Vercel demo.

## Database

The demo does not use a database.

`db/config.js` and `db/localdata.js` export stubs that throw a clear error if any module tries to open a MySQL connection:

```text
Demo repository: MySQL is intentionally disabled.
```

This prevents accidental database access in Vercel or local demo runs.

## Views

The full EJS view layer is preserved in `views/`. The demo reuses those views so the UI remains representative of the real product.

The navbar includes a demo badge to make it clear that the visible data is mock data.
