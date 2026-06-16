# Vercel Deployment

## Requirements

- Node.js 20 or higher.
- A Git repository with this folder as the project root.
- A Vercel account.

## Recommended Settings

In Vercel:

```text
Framework Preset: Other
Build Command:    leave empty
Output Directory: leave empty
Install Command:  npm install
```

No database setup is required.

## Environment Variables

Optional:

```text
SESSION_SECRET=<long-random-string>
```

The demo has a fallback value, but a public deployment should define its own session secret.

Do not configure:

- `MYSQL_*`
- `OPENAI_API_KEY`
- `CF_API_TOKEN`
- WhatsApp credentials

They are not used by the demo runtime.

## Routing

`vercel.json` sends every request to the serverless function:

```json
{
  "version": 2,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/api"
    }
  ]
}
```

The function entrypoint is:

```text
api/index.js
```

## Test Locally Before Publishing

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:4080
```

You can also verify key endpoints:

```bash
curl -H "Accept: application/json" http://localhost:4080/places
curl -H "Accept: application/json" http://localhost:4080/leads
curl -H "Accept: application/json" http://localhost:4080/stats
```
