# Arquitectura

Este repositorio conserva la forma de la aplicacion real, pero ejecuta una capa demo aislada.

La aplicacion original tiene una version productiva para cliente. Esta demo publica mantiene su arquitectura para revision tecnica, pero reemplaza el runtime productivo por datos mock y stubs de base de datos.

## Runtime demo

El runtime activo en local y Vercel es:

```text
server.js
└── api/index.js
    └── routes/demo.js
        └── db/demoData.js
```

`api/index.js` configura Express, sesiones en memoria, EJS y las vistas. Despues monta `routes/demo.js`, que responde las pantallas y APIs con datos mock.

## Runtime real conservado

La estructura real se mantiene para mostrar como estaria organizada la implementacion productiva:

- `routes/index.js`: rutas reales de la aplicacion.
- `controllers/`: logica HTTP por dominio.
- `models/`: acceso a datos MySQL.
- `middleware/`: autenticacion, roles y permisos.
- `services/`: integraciones externas.
- `db/migrations/` y `migrations/`: cambios de esquema.
- `scripts/`: tareas operativas y migraciones auxiliares.

En esta demo publica esos archivos no son el camino de ejecucion principal.

## Base de datos

La demo no usa base de datos.

`db/config.js` y `db/localdata.js` exportan stubs que lanzan un error claro si algun modulo intenta abrir MySQL:

```text
Demo repository: MySQL is intentionally disabled.
```

Esto evita conexiones accidentales en Vercel o en una maquina local.

## Vistas

Las vistas EJS se mantienen completas en `views/`. La demo reutiliza esas vistas para que la interfaz sea representativa del producto real.

El navbar muestra una etiqueta de demo para dejar claro que los datos son mock.
