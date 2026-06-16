# Nota para reviewers

Este repositorio es una demo publica y anonimizada de una aplicacion real que corre en produccion para cliente. La demo conserva la estructura tecnica del proyecto, pero sustituye la ejecucion productiva por mock data para poder publicarla sin datos privados, credenciales ni base de datos.

## 3-line answer

```text
LeadOps is a production-style CRM/prospecting dashboard for finding local businesses, converting discovered places into leads, assigning follow-ups, tracking funnel stages, and reviewing sales performance. Demo: <LIVE_DEMO_URL> Repo: <REPO_URL>
My role: I designed and built the full-stack Express/EJS app structure, including auth/roles, lead/place workflows, admin panels, stats, funnel flows, and the Vercel-ready public demo.
Hardest technical decision: preserving the production-like MySQL architecture while making the public version run safely on mock APIs only, so reviewers can inspect the real structure without exposing client data or requiring a database.
```

## Contexto

La version real esta pensada para:

- MySQL.
- Sesiones persistentes.
- Roles de usuario.
- Gestion de places y leads.
- Funnel comercial.
- Estadisticas.
- Integraciones externas.

La version publica:

- Usa `routes/demo.js`.
- Usa `db/demoData.js`.
- Desactiva `db/config.js` y `db/localdata.js`.
- No ejecuta migraciones ni servicios externos.
- No contiene datos reales de clientes.

## Que revisar

Para entender rapido el proyecto:

1. Empieza por `/places`.
2. Mira como se convierte un place en lead.
3. Revisa `/leads` para ver gestion comercial.
4. Revisa `/stats` para ver resumen de rendimiento.
5. Abre `routes/demo.js`, `db/demoData.js`, `controllers/` y `models/` para comparar la capa demo con la estructura real conservada.
