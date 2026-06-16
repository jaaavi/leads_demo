# Despliegue en Vercel

## Requisitos

- Node.js 20 o superior.
- Repositorio Git con esta carpeta como raiz.
- Cuenta de Vercel.

## Configuracion recomendada

En Vercel:

```text
Framework Preset: Other
Build Command:    vacio
Output Directory: vacio
Install Command:  npm install
```

No hace falta configurar base de datos.

## Variables de entorno

Opcional:

```text
SESSION_SECRET=<cadena-aleatoria-larga>
```

La demo tiene un valor por defecto, pero en un despliegue publico es mejor definir uno propio.

No configures:

- `MYSQL_*`
- `OPENAI_API_KEY`
- `CF_API_TOKEN`
- Credenciales de WhatsApp

No se usan en el runtime demo.

## Rutas

`vercel.json` envia todo a la funcion serverless:

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

La funcion esta en:

```text
api/index.js
```

## Prueba local antes de publicar

```bash
npm install
npm run dev
```

Abre:

```text
http://localhost:4080
```

Tambien puedes verificar algunos endpoints:

```bash
curl -H "Accept: application/json" http://localhost:4080/places
curl -H "Accept: application/json" http://localhost:4080/leads
curl -H "Accept: application/json" http://localhost:4080/stats
```
