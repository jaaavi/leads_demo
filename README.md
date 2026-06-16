# WLD Leads Dashboard Demo

Demo publica de un dashboard para prospeccion comercial, gestion de leads y seguimiento de oportunidades locales.

Este repositorio esta preparado para GitHub y Vercel. Mantiene la estructura completa de una aplicacion Express/EJS real (`controllers`, `models`, `middleware`, `services`, `scripts`, migraciones y vistas), pero la ejecucion publica esta aislada y funciona solo con mock data en memoria.

## Que muestra

- Panel de busqueda y generacion de oportunidades.
- Listado de places procedentes de busquedas tipo Google Maps.
- Gestion de leads con filtros, asignacion, estados y acciones.
- Estadisticas comerciales y funnel.
- Calendario de seguimiento.
- Panel de WhatsApp simulado.
- Estrategias de mensajes.
- Herramientas y pantallas de administracion.
- Documentacion interna de roles y flujos.

## Demo segura

La demo no conecta con una base de datos y no necesita credenciales externas.

- Los datos salen de [`db/demoData.js`](db/demoData.js).
- Las rutas que responde la demo estan en [`routes/demo.js`](routes/demo.js).
- La entrada serverless de Vercel esta en [`api/index.js`](api/index.js).
- `db/config.js` y `db/localdata.js` estan desactivados a proposito para impedir conexiones MySQL.
- La estructura real se conserva como referencia tecnica, pero no se ejecuta en Vercel.

La implementacion real del producto esta pensada para MySQL, sesiones persistentes, servicios externos y migraciones. En este repo publico esa parte se conserva como arquitectura visible, no como runtime activo.

## Stack

- Node.js
- Express
- EJS
- Bootstrap
- Vercel Serverless Functions
- Mock data en memoria

## Estructura

```text
.
├── api/                  # Entrada serverless para Vercel
├── controllers/          # Controladores de la implementacion real
├── db/                   # Mock data, stubs de DB y migraciones reales
├── middleware/           # Middleware de autenticacion/roles
├── migrations/           # Migraciones SQL historicas
├── models/               # Modelos de la implementacion real
├── routes/               # Rutas reales y rutas demo
├── scripts/              # Scripts operativos/migraciones
├── server/               # Arranque local compatible con la demo
├── services/             # Servicios externos de la implementacion real
├── utils/                # Utilidades compartidas
├── views/                # Vistas EJS
├── vercel.json           # Rewrites para desplegar en Vercel
└── docs/                 # Documentacion del repo demo
```

## Ejecutar localmente

```bash
npm install
npm run dev
```

Abre:

```text
http://localhost:4080
```

La demo inicia sesion automaticamente como `demo_admin`. Tambien puedes enviar `demo_comercial` en el login para ver el rol comercial pro. La password no se valida porque no hay usuarios reales ni base de datos.

## Desplegar en Vercel

1. Sube esta carpeta como repositorio nuevo.
2. Importa el repositorio en Vercel.
3. Framework preset: `Other`.
4. Build command: vacio.
5. Output directory: vacio.
6. Install command: `npm install`.

Opcional:

```text
SESSION_SECRET=<cadena-aleatoria-larga>
```

Vercel enviara todas las rutas a `api/index.js` mediante [`vercel.json`](vercel.json).

## Documentacion

- [Arquitectura](docs/ARCHITECTURE.md)
- [Modo demo y mock data](docs/DEMO_MODE.md)
- [API demo](docs/API.md)
- [Despliegue en Vercel](docs/VERCEL_DEPLOY.md)
- [Seguridad y publicacion](docs/SECURITY.md)

Tambien se conservan documentos operativos del proyecto original:

- [Autenticacion y roles](AUTH_README.md)
- [Variables de entorno](ENV_SETUP.md)
- [Instalacion Linux](INSTALL_LINUX.md)
- [Herramientas](TOOLS_SETUP.md)

## Notas para repositorio publico

Este repositorio no debe contener `.env`, sesiones, claves API, credenciales MySQL ni datos reales. El archivo `.env.example` es solo una plantilla saneada.

`node_modules/` y `.vercel/` estan ignorados por Git.

## Licencia

Demo tecnica para presentacion del producto. Define una licencia antes de permitir reutilizacion publica del codigo.
# leads_demo
