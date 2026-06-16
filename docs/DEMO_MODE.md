# Modo Demo

La demo esta disenada para poder publicarse sin base de datos, sin secretos y sin servicios externos.

## Datos

Los datos estan en:

```text
db/demoData.js
```

Incluyen:

- Usuarios demo.
- Places.
- Leads.
- Jobs.
- Acciones de leads.
- Mensajes simulados de WhatsApp.
- Estado de funnel.

Los cambios hechos desde la interfaz se guardan en memoria mientras el proceso esta vivo. En Vercel, al tratarse de funciones serverless, esos cambios no deben considerarse persistentes.

## Sesion

La demo crea automaticamente una sesion si no existe:

- Usuario por defecto: `demo_admin`
- Rol por defecto: `admin`

En el login se puede usar `demo_comercial` para simular un usuario `comercial_pro`.

La password no se valida porque no existe una tabla real de usuarios en la demo.

## Rutas

La demo mantiene endpoints compatibles con la interfaz:

- `/places`
- `/leads`
- `/stats`
- `/calendar`
- `/whatsapp`
- `/admin/users`
- `/admin/strategies`
- `/admin/subdomains`
- `/admin/tools`

Las operaciones de escritura modifican arrays en memoria o devuelven respuestas simuladas.

## Servicios externos

No se ejecutan:

- MySQL
- WhatsApp/Baileys
- OpenAI
- Cloudflare
- Scheduler
- Migraciones

Los archivos de esos servicios se conservan como referencia de arquitectura.
