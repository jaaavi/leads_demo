# ⚙️ Configuración de Variables de Entorno

## Desarrollo Local

**Archivo: `dashboard/.env`**

```env
NODE_ENV=development
PORT=4080
SESSION_SECRET=desarrollo-secret-key-cambiar-en-produccion
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=leads_demo
MYSQL_SOCKET=/var/run/mysqld/mysqld.sock
```

## Producción Linux

**Opción 1: Archivo `.env`**

```env
NODE_ENV=production
PORT=7090
SESSION_SECRET=tu-clave-aleatoria-de-32-caracteres-minimo
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=tu_usuario_mysql
MYSQL_PASSWORD=tu_password_mysql
MYSQL_DATABASE=leads_demo
MYSQL_SOCKET=/var/run/mysqld/mysqld.sock
```

**Opción 2: systemd (recomendado para Linux)**

Todo está en `leads-dashboard.service`. Solo necesitas:

```bash
sudo cp leads-dashboard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start leads-dashboard.service
```

## Variables Disponibles

| Variable | Desarrollo | Producción | Descripción |
|----------|------------|-----------|-------------|
| `NODE_ENV` | development | production | Modo de ejecución |
| `PORT` | 4080 | 7090 | Puerto del servidor |
| `SESSION_SECRET` | cambiar-esto | 32+ caracteres aleatorios | Clave de sesión |
| `MYSQL_HOST` | localhost | localhost o IP | Host MySQL |
| `MYSQL_PORT` | 3306 | 3306 | Puerto MySQL |
| `MYSQL_USER` | root | tu_usuario_mysql | Usuario BD |
| `MYSQL_PASSWORD` | (vacío) | tu_password_mysql | Contraseña BD |
| `MYSQL_DATABASE` | leads_demo | leads_demo | Base de datos |
| `MYSQL_SOCKET` | /var/run/mysqld/mysqld.sock | /var/run/mysqld/mysqld.sock | Socket MySQL |

## Cómo usar

### Desarrollo (Windows/Mac/Linux local)

1. Crea `dashboard/.env` desde `.env.example`
2. Configura tus valores locales
3. Ejecuta:
   ```bash
   cd dashboard/server
   npm start
   ```

### Producción Linux (systemd)

1. Edita `/etc/systemd/system/leads-dashboard.service`
2. Actualiza las variables de entorno
3. Ejecuta:
   ```bash
   sudo systemctl restart leads-dashboard.service
   ```

## Socket MySQL en Linux

La ruta del socket puede variar:

- **Ubuntu/Debian:** `/var/run/mysqld/mysqld.sock`
- **CentOS/RHEL:** `/var/lib/mysql/mysql.sock`
- **Otra:** Verifica con: `sudo find / -name mysqld.sock 2>/dev/null`

## Generar SESSION_SECRET seguro

```bash
openssl rand -base64 32
```

Copia el resultado a `SESSION_SECRET` en tu archivo `.env`

## Archivo .env en .gitignore

✅ Ya está configurado en `dashboard/.gitignore`

Nunca commits `.env` a git (contiene contraseñas)

## Verificar configuración

```bash
# Ver variables que Node.js está usando
node -e "console.log(process.env)" | grep MYSQL
```
