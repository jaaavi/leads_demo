# Seguridad

Este repositorio esta pensado para publicarse como demo.

## Que no debe subirse

- `.env`
- `.env.local`
- Claves API
- Credenciales MySQL
- Sesiones de WhatsApp
- Datos reales de clientes
- Dumps de base de datos
- Capturas con informacion sensible

`.gitignore` ya excluye `.env`, `.env.*`, `.vercel/` y `node_modules/`.

`.env.example` si debe subirse porque es una plantilla saneada.

## Base de datos desactivada

`db/config.js` y `db/localdata.js` no crean conexiones. Si algun modulo intenta usar MySQL, se lanza un error explicito.

Esto protege el despliegue publico frente a conexiones accidentales.

## Servicios externos

Los archivos de servicios (`services/`) se conservan para mostrar arquitectura, pero el runtime demo no los importa.

No configures claves de:

- OpenAI
- Cloudflare
- WhatsApp
- Google APIs

## Datos mock

Los datos mock estan en `db/demoData.js`. Antes de publicar, revisa que no contengan nombres, telefonos, emails o URLs reales de clientes.

## Checklist antes de hacer push

```bash
git status --short
npm audit --omit=dev
rg -n "sk-|BEGIN PRIVATE|MYSQL_PASSWORD=|CF_API_TOKEN=|OPENAI_API_KEY=" . -g "!node_modules" -g "!package-lock.json"
```

Los resultados deben contener solo placeholders o documentacion saneada.
