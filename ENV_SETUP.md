# Environment Setup

This repository is a public demo. It does not require MySQL or external API credentials to run the Vercel demo.

The environment variables below describe the production-style application that this demo is based on. Use them only for a private real deployment, not for the public demo.

## Public Demo

For local demo usage:

```env
NODE_ENV=development
PORT=4080
SESSION_SECRET=change-this-local-demo-secret
```

Run:

```bash
npm install
npm run dev
```

## Vercel Demo

Optional Vercel variable:

```env
SESSION_SECRET=your-long-random-session-secret
```

Do not configure MySQL, OpenAI, Cloudflare, or WhatsApp credentials for the public demo.

## Production-Style Private Deployment

Example `.env` for a private deployment:

```env
NODE_ENV=production
PORT=7090
SESSION_SECRET=replace-with-a-random-32-plus-character-secret
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=your_mysql_user
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=leads_demo
MYSQL_SOCKET=/var/run/mysqld/mysqld.sock
```

## Variables

| Variable | Demo | Private production | Description |
| --- | --- | --- | --- |
| `NODE_ENV` | `development` | `production` | Runtime mode |
| `PORT` | `4080` | `7090` | HTTP port |
| `SESSION_SECRET` | local secret | 32+ random chars | Session signing secret |
| `MYSQL_HOST` | not used | host/IP | MySQL host |
| `MYSQL_PORT` | not used | `3306` | MySQL port |
| `MYSQL_USER` | not used | private user | MySQL user |
| `MYSQL_PASSWORD` | not used | private password | MySQL password |
| `MYSQL_DATABASE` | not used | database name | MySQL database |
| `MYSQL_SOCKET` | not used | optional socket path | MySQL socket |

## Generating a Session Secret

```bash
openssl rand -base64 32
```

## Important

Never commit `.env` files. `.env.example` is sanitized and safe to commit.
