# API Demo

La API demo responde los endpoints principales que usa la interfaz. Los datos vienen de `db/demoData.js`.

## Places

```http
GET /places
GET /places/meta
GET /places/:id
POST /places
PUT /places/:id
DELETE /places/:id
POST /places/:id/create-lead
POST /places/bulk/create-leads
POST /places/bulk/create-leads-assign
POST /places/bulk/delete
```

Filtros soportados en `GET /places`:

- `page`
- `pageSize`
- `mainCategory`
- `city`
- `barrio`
- `hasWeb`
- `hasPhone`
- `q`
- `tag`
- `phoneType`
- `jobId`

## Leads

```http
GET /leads
GET /leads/meta
GET /leads/:id
POST /leads
PUT /leads/:id
DELETE /leads/:id
GET /leads/:lead_id/actions
POST /leads/:lead_id/actions
POST /leads/bulk/assign
POST /leads/bulk/delete
POST /leads/generate
POST /leads/:id/send-to-places
```

Filtros soportados en `GET /leads`:

- `page`
- `pageSize`
- `status`
- `source`
- `city`
- `barrio`
- `phone_type`
- `q`
- `assigned_to`
- `pending_reply`
- `has_web`
- `funnel_phase`
- `jobId`

## Estadisticas

```http
GET /stats
GET /stats/funnel
GET /stats/monthly
GET /stats/source-performance
GET /stats/user-performance
```

## Admin

```http
GET /api/admin/users
POST /api/admin/users
PUT /api/admin/users/:userId/role
PUT /api/admin/users/:userId/password
DELETE /api/admin/users/:userId

GET /api/admin/subdomains
POST /api/admin/subdomains

GET /api/admin/strategies
GET /api/admin/strategies/:id
POST /api/admin/strategies
PUT /api/admin/strategies/:id
DELETE /api/admin/strategies/:id
POST /api/admin/strategies/:id/activate
```

## WhatsApp simulado

```http
GET /whatsapp/qr
GET /whatsapp/status
GET /whatsapp/messages/:lead_id
POST /whatsapp/send-message
POST /whatsapp/disconnect
```

Las respuestas son simuladas y no envian mensajes reales.
