# Demo Mode

The demo is designed to be published without a database, secrets, or external services.

It is a public, anonymized version of an application that has a real production deployment for a client. The goal of this folder is not to pretend that Vercel is connected to production. The goal is to show the interface, workflows, and architecture without exposing private data.

## Data

All demo data lives in:

```text
db/demoData.js
```

It includes:

- Demo users.
- Places.
- Leads.
- Jobs.
- Lead actions.
- Simulated WhatsApp messages.
- Funnel state.

Changes made from the UI are stored in memory while the process is alive. On Vercel, because serverless functions are ephemeral, those changes should not be treated as persistent.

## Session

The demo automatically creates a session when none exists:

- Default user: `demo_admin`
- Default role: `admin`

The login form can also accept `demo_comercial` to simulate a `comercial_pro` user.

Passwords are not validated because the demo does not have a real users table.

## Routes

The demo keeps the main endpoints expected by the UI:

- `/places`
- `/leads`
- `/stats`
- `/calendar`
- `/whatsapp`
- `/admin/users`
- `/admin/strategies`
- `/admin/subdomains`
- `/admin/tools`

Write operations either mutate in-memory arrays or return simulated responses.

## External Services

The demo does not run:

- MySQL
- WhatsApp/Baileys
- OpenAI
- Cloudflare
- Scheduler jobs
- Migrations

Files for those services are kept as architecture references only.
