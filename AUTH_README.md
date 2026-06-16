# Sistema de Autenticación del Dashboard

## Descripción

Se ha implementado un sistema de autenticación seguro basado en:
- **bcrypt** para hash de contraseñas
- **express-session** para sesiones seguras
- **MySQL** para almacenamiento de usuarios
- **Middleware** de protección en todas las rutas

## Crear Nuevo Usuario

### Paso 1: Instalar dependencias (si no lo has hecho)

```bash
cd dashboard/server
npm install
```

### Paso 2: Ejecutar el script de creación de usuario

```bash
cd dashboard
node scripts/createUser.js
```

El script te pedirá:
1. **Username**: Nombre de usuario (único)
2. **Email**: Correo electrónico (único)
3. **Password**: Contraseña (mínimo 6 caracteres)

**Ejemplo:**
```
=== Crear nuevo usuario ===

Username: admin
Email: admin@example.com
Password: mi_contraseña_segura

✓ Usuario creado exitosamente!
  ID: 1
  Username: admin
  Email: admin@example.com
```

## Acceso al Dashboard

### Login

1. Abre el navegador y ve a `http://localhost:4080/login`
2. Introduce tu username y contraseña
3. Se te redirigirá al dashboard principal

### Logout

Haz clic en el botón "Salir" en la esquina superior derecha de cualquier página.

## Características de Seguridad

✅ **Contraseñas hasheadas**: Utilizamos bcrypt con 10 rondas de salt
✅ **Sesiones seguras**: Cookies httpOnly + secure (en producción)
✅ **Validación de entrada**: Email válido, contraseña mínimo 6 caracteres
✅ **Protección de rutas**: Todas las rutas requieren autenticación
✅ **API protegida**: Endpoints JSON requieren autenticación (devuelven 401)

## Variables de Entorno (Producción)

Para producción, establece estas variables:

```env
SESSION_SECRET=tu-secreto-super-seguro-cambiar-en-produccion
NODE_ENV=production
```

## Estructura de Tablas

La tabla `users` se crea automáticamente con:
- `id`: ID único (AUTO_INCREMENT)
- `username`: Nombre de usuario (UNIQUE)
- `email`: Correo electrónico (UNIQUE)
- `password_hash`: Hash bcrypt de la contraseña
- `created_at`: Fecha de creación
- `updated_at`: Fecha de última actualización

## Archivos Relevantes

- `models/userModel.js`: Modelo de usuario y operaciones BD
- `controllers/authController.js`: Lógica de login/logout
- `middleware/auth.js`: Middlewares de protección
- `views/login.ejs`: Página de login
- `scripts/createUser.js`: Script de creación de usuarios
- `server/app.js`: Configuración de sesiones

## Troubleshooting

### Error: "Username or email already exists"
- El usuario o email ya existe en la BD
- Usa un username o email diferente

### Error: "Password must be at least 6 characters long"
- La contraseña debe tener al menos 6 caracteres

### Error: "Credenciales inválidas" en login
- Verifica que el username sea correcto
- Verifica que la contraseña sea correcta
- Sensibilidad de mayúsculas: el username no es sensible a mayúsculas en búsqueda (pero el username almacenado usa lo que escribiste)

### Error: "Unauthorized" en API
- Tu sesión ha expirado (válida 24 horas)
- Vuelve a login

## Cambios de Seguridad para Producción

1. **Cambiar SESSION_SECRET**: En `server/app.js`, configura una contraseña aleatoria de al menos 32 caracteres
2. **Habilitar secure cookies**: Establece `NODE_ENV=production`
3. **HTTPS obligatorio**: En producción, usa HTTPS
4. **Rate limiting**: Considera agregar rate limiting en el login
5. **2FA**: Para mayor seguridad, considera implementar autenticación de dos factores
