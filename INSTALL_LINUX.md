# 🐧 Instalación en Linux con systemd

## Paso 1: Copiar archivo .service

Copia el contenido de `wld-dashboard.service` a:

```bash
sudo nano /etc/systemd/system/wld-dashboard.service
```

O directamente:

```bash
sudo cp /ruta/al/proyecto/dashboard/wld-dashboard.service /etc/systemd/system/
```

## Paso 2: Editar archivo .service

**IMPORTANTE:** Edita estos valores en el archivo `.service`:

1. **WorkingDirectory**: Cambia `/home/your-user/wld-dashboard/dashboard/server` por la ruta real
   ```
   WorkingDirectory=/home/tu-usuario/ruta-al-proyecto/dashboard/server
   ```

2. **SESSION_SECRET**: Cambia el valor por una cadena aleatoria de al menos 32 caracteres
   ```bash
   openssl rand -base64 32
   ```

3. **Verificar rutas:**
   - La ruta del socket MySQL: `/var/run/mysqld/mysqld.sock` (o la que uses en tu servidor)
   - Usuario Node.js: `www-data` (o el usuario que uses)

## Paso 3: Recargar systemd

```bash
sudo systemctl daemon-reload
```

## Paso 4: Habilitar el servicio

```bash
sudo systemctl enable wld-dashboard.service
```

## Paso 5: Iniciar el servicio

```bash
sudo systemctl start wld-dashboard.service
```

## Verificar estado

```bash
sudo systemctl status wld-dashboard.service
```

Ver logs en tiempo real:

```bash
sudo journalctl -u wld-dashboard.service -f
```

## Comandos útiles

**Detener servicio:**
```bash
sudo systemctl stop wld-dashboard.service
```

**Reiniciar servicio:**
```bash
sudo systemctl restart wld-dashboard.service
```

**Ver últimos 100 logs:**
```bash
sudo journalctl -u wld-dashboard.service -n 100
```

**Ver logs de error:**
```bash
sudo journalctl -u wld-dashboard.service -p err
```

## Estructura de archivo .service

El archivo contiene:

```
[Unit]           → Información del servicio
[Service]        → Cómo ejecutar el servicio
[Install]        → Cómo instalarlo en el sistema
```

### Componentes importantes:

- **After=network.target mysql.service** → Espera a que MySQL esté activo
- **User=www-data** → Usuario que ejecuta el servicio
- **ExecStart=/usr/bin/node app.js** → Comando a ejecutar
- **Restart=always** → Reinicia automáticamente si falla
- **RestartSec=10** → Espera 10s antes de reintentar
- **Environment** → Variables de entorno (credenciales de BD, puerto, etc.)

## Variables de entorno en el .service

```
NODE_ENV=production          → Modo producción
PORT=7090                    → Puerto 7090
MYSQL_USER=tu_usuario_mysql  → Usuario BD (producción)
MYSQL_PASSWORD=tu_password_mysql → Contraseña BD
MYSQL_DATABASE=wld_leads     → Nombre base de datos
MYSQL_SOCKET=/var/run/mysqld/mysqld.sock → Socket MySQL
```

## Troubleshooting

### Error: "Failed to start wld-dashboard.service"

```bash
sudo journalctl -u wld-dashboard.service -p err
```

Revisa si:
- La ruta en `WorkingDirectory` existe
- Node.js está instalado en `/usr/bin/node`
- MySQL está corriendo
- El usuario `www-data` tiene permisos

### Error: "Cannot find module"

Asegúrate de haber corrido `npm install` en `dashboard/server`

### Error de conexión a MySQL

Verifica:
- Usuario y contraseña correctos
- Base de datos existe
- Socket path correcto: `ls -la /var/run/mysqld/mysqld.sock`

### Puerto 7090 ya en uso

Cambia `PORT=7090` en el archivo `.service` por otro puerto disponible

## Verificar que todo funciona

1. Comprueba el estado del servicio:
   ```bash
   sudo systemctl status wld-dashboard.service
   ```

2. Verifica que escucha en puerto 7090:
   ```bash
   sudo netstat -tlnp | grep 7090
   ```

3. Accede a http://your-server:7090/login

4. Revisa logs si hay problemas:
   ```bash
   sudo journalctl -u wld-dashboard.service -f
   ```
