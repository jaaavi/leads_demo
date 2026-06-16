# Security

This repository is intended to be published as a public demo.

## Do Not Commit

- `.env`
- `.env.local`
- API keys
- MySQL credentials
- WhatsApp sessions
- Real client data
- Database dumps
- Screenshots containing sensitive information

`.gitignore` already excludes `.env`, `.env.*`, `.vercel/`, and `node_modules/`.

`.env.example` should be committed because it is a sanitized template.

## Database Disabled

`db/config.js` and `db/localdata.js` do not create connections. If any module tries to use MySQL, a clear error is thrown.

This protects the public deployment from accidental database access.

## External Services

Service files in `services/` are kept to show architecture, but the demo runtime does not import them.

Do not configure keys for:

- OpenAI
- Cloudflare
- WhatsApp
- Google APIs

## Mock Data

Mock data lives in `db/demoData.js`. Before publishing, make sure it does not contain real client names, phone numbers, emails, or URLs.

## Pre-Push Checklist

```bash
git status --short
npm audit --omit=dev
rg -n "sk-|BEGIN PRIVATE|MYSQL_PASSWORD=|CF_API_TOKEN=|OPENAI_API_KEY=" . -g "!node_modules" -g "!package-lock.json"
```

The results should contain only sanitized placeholders or documentation.
