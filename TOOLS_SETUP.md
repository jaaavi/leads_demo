# Herramientas de Admin - Guía de Configuración

## Descripción

Se ha agregado una nueva sección de **Herramientas** visible solo para administradores. Esta sección incluye 3 herramientas principales:

### 1. Analizador de Imágenes con IA
Utiliza la API de OpenAI (Vision) para:

1. Analizar imágenes automáticamente
2. Generar títulos SEO únicos en minúsculas con guiones
3. Crear descripciones profesionales
4. Renombrar archivos automáticamente
5. Generar un archivo JSON con los metadatos

## Requisitos

### 1. OpenAI API Key

Para que la herramienta funcione, necesitas configurar tu clave de API de OpenAI:

1. Accede a https://platform.openai.com/api/keys
2. Crea una nueva API key (o usa una existente)
3. Copia la key

### 2. Variable de Entorno

Configura la variable `OPENAI_API_KEY` en tu archivo `.env`:

```
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Opcionalmente, puedes especificar el modelo de OpenAI (por defecto es gpt-4):

```
OPENAI_MODEL=gpt-4o
```

### 2. Conversor WEBP → PNG
Convierte automáticamente imágenes en formato WEBP a PNG.

### 3. Conversor JPG/PNG → WEBP
Convierte automáticamente imágenes en formato JPG o PNG a WEBP (formato optimizado web).

## Acceso a las Herramientas

1. **Solo Admins**: Las herramientas son visibles únicamente para usuarios con rol de administrador
2. **Ubicación**: En el menú navegación superior, encontrarás el enlace "Herramientas" con un icono de llave inglesa
3. **URL**: `/admin/tools`
4. **Pestañas disponibles**:
   - Analizador de Imágenes
   - Metadatos
   - WEBP → PNG
   - JPG/PNG → WEBP

## Funcionalidades

### Analizador de Imágenes

**Pestaña 1: Analizador de Imágenes**

1. **Cargar imágenes**: Arrastra imágenes o haz clic para seleccionar
   - Formatos soportados: JPG, JPEG, PNG, WebP
   - Tamaño máximo: 10MB por imagen
   - Máximo: 20 imágenes por análisis

2. **Analizar**: El sistema procesará las imágenes:
   - Comprime la imagen para optimizar uso de tokens
   - Envía a OpenAI para análisis
   - Espera 1 segundo entre análisis (evita rate limiting)
   - Renombra archivos con el título SEO generado
   - Guarda metadatos en JSON

3. **Resultados**:
   - Visualiza éxitos y errores inmediatamente
   - Ve el título SEO generado
   - Consulta la descripción automática

### Metadatos

**Pestaña 2: Metadatos**

1. **Vista de imágenes**: Todas las imágenes analizadas
2. **Información**: Título, descripción, nombre del archivo, fecha
3. **Acciones**:
   - **Ver**: Abre la imagen en una nueva pestaña
   - **Eliminar**: Borra la imagen y su entrada en metadatos
4. **Descargar JSON**: Exporta todos los metadatos en formato JSON

## Estructura de Archivos

Los archivos se organizan en:

```
public/
├── uploads/
│   ├── images/           # Imágenes procesadas
│   │   └── metadata.json # Metadatos de todas las imágenes
│   └── temp/            # Archivos temporales durante upload
```

## Estructura de Metadatos

El archivo `metadata.json` contiene un array con objetos como:

```json
[
  {
    "id": 1731698123456.123,
    "name": "masaje_tailandes_cabina_relax_luz_calida.jpg",
    "originalName": "IMG_2024.jpg",
    "title": "masaje_tailandes_cabina_relax_luz_calida",
    "description": "Cabina de masaje tailandés con iluminación cálida y ambiente relajante",
    "uploadedAt": "2024-11-15T17:48:43.456Z",
    "url": "/static/uploads/images/masaje_tailandes_cabina_relax_luz_calida.jpg"
  }
]
```

## Reglas de Generación de Títulos

El título SEO generado debe cumplir:

1. **Formato**: Slug en minúsculas, sin espacios (usa guiones bajos)
2. **Sem ántica**: Combina 3 elementos:
   - Tipo de negocio/contexto (ej: masaje_tailandes, clinica_dental)
   - Elemento principal visible (ej: cabina_relax, zona_trabajo)
   - Detalle único visual (ej: luz_calida, pared_madera)
3. **Restricciones**:
   - Sin números, códigos, ni IDs
   - Sin palabras genéricas como "imagen", "foto", "pic"
   - Único para cada proyecto (no se repite)

## Ejemplo de Uso

### Paso 1: Cargar imágenes
- Selecciona 5 fotos de tu restaurante

### Paso 2: Analizar
- Haz clic en "Analizar Imágenes"
- Espera a que se procesen (verás un spinner por cada imagen)

### Paso 3: Revisar resultados
```
✅ IMG_2024.jpg
Título SEO: restaurante_comedor_decoracion_moderna
Descripción: Comedor del restaurante con decoración contemporánea y mesas de madera...

✅ IMG_2025.jpg
Título SEO: restaurante_cocina_abierta_chef_preparando
Descripción: Cocina abierta mostrando al chef preparando platos...
```

### Paso 4: Descargar metadatos
- Ve a la pestaña "Metadatos"
- Haz clic en "Descargar JSON"
- Obtendrás el archivo `imagenes.json` con todos los datos

## Solución de Problemas

### Error: "OpenAI API key is not configured"
**Causa**: No has configurado `OPENAI_API_KEY` en el `.env`
**Solución**: Agrega la variable y reinicia el servidor

### Error: "OpenAI Error: ..."
**Causa**: Problema con la API de OpenAI (cuota excedida, API key inválida, etc.)
**Solución**: Verifica tu API key en https://platform.openai.com/api/keys

### Timeout o lentitud
**Causa**: Las imágenes son muy grandes
**Solución**: Las imágenes se comprimen automáticamente, pero aún así el análisis puede tardar

### Archivo no se renombra
**Causa**: El análisis falló
**Solución**: Revisa la consola para más detalles del error

## Estadísticas de Tokens

OpenAI cobra por tokens utilizados. Cada imagen consume:
- **Tokens de entrada**: Depende del tamaño de la imagen (aproximadamente 100-300 tokens)
- **Tokens de salida**: ~50-100 tokens para el JSON generado

Para ver el consumo de tokens, revisa tu dashboard en https://platform.openai.com/account/usage

## Seguridad

- ✅ Solo accesible para admins
- ✅ Las imágenes se guardan en el servidor
- ✅ Los metadatos se almacenan en JSON
- ✅ Los archivos temporales se limpian automáticamente
- ✅ Validación de tipos de archivo (solo imágenes)
- ✅ Límite de tamaño: 10MB por archivo

## Notas sobre Analizador de Imágenes

- El sistema intenta 3 veces si hay errores (con espera de 5 segundos)
- Se espera 1 segundo entre análisis para evitar rate limiting
- Las imágenes duplicadas se renombran automáticamente añadiendo sufijos (_2, _3, etc)
- Los metadatos se guardan en tiempo real, no necesita confirmación final

---

## Conversor WEBP → PNG

### Descripción
Convierte imágenes en formato WEBP a PNG de forma automática.

### Características
- ✅ Conversión rápida de WEBP a PNG
- ✅ Procesamiento por lotes (hasta 50 imágenes)
- ✅ Vista previa en tiempo real
- ✅ Descarga directa de archivos convertidos
- ✅ Eliminación de imágenes convertidas

### Ubicación de Archivos
```
public/uploads/webp-to-png/    ← Imágenes convertidas
```

### Uso
1. Ve a la pestaña "WEBP → PNG"
2. Arrastra o selecciona archivos WEBP
3. Haz clic en "Convertir a PNG"
4. Los archivos se procesarán automáticamente
5. Visualiza, descarga o elimina los resultados

### Especificaciones
- **Formato entrada**: WEBP
- **Formato salida**: PNG
- **Tamaño máximo**: 10MB por imagen
- **Máximo por lote**: 50 imágenes
- **Calidad**: Lossless (sin pérdida)

---

## Conversor JPG/PNG → WEBP

### Descripción
Convierte imágenes en formato JPG o PNG a WEBP (formato web optimizado).

### Características
- ✅ Conversión optimizada a WEBP
- ✅ Procesamiento por lotes (hasta 50 imágenes)
- ✅ Compresión inteligente (calidad 80)
- ✅ Vista previa en tiempo real
- ✅ Eliminación de imágenes convertidas

### Ubicación de Archivos
```
public/uploads/to-webp/    ← Imágenes convertidas
```

### Uso
1. Ve a la pestaña "JPG/PNG → WEBP"
2. Arrastra o selecciona archivos JPG o PNG
3. Haz clic en "Convertir a WEBP"
4. Los archivos se procesarán automáticamente
5. Visualiza o elimina los resultados

### Especificaciones
- **Formato entrada**: JPG, JPEG, PNG
- **Formato salida**: WEBP
- **Tamaño máximo**: 10MB por imagen
- **Máximo por lote**: 50 imágenes
- **Calidad**: 80 (balance entre calidad y tamaño)
- **Ventaja**: WEBP es 25-35% más pequeño que JPG

### Beneficios del WEBP
- 📉 Tamaño de archivo más pequeño
- ⚡ Carga más rápida
- 🎨 Mejor calidad a menor tamaño
- 📱 Compatible con navegadores modernos

---

## Estructura de Carpetas

```
public/
├── uploads/
│   ├── images/              # Analizador de imágenes
│   │   └── metadata.json
│   ├── webp-to-png/         # Conversión WEBP → PNG
│   ├── to-webp/             # Conversión JPG/PNG → WEBP
│   └── temp/                # Archivos temporales
```

---

## Comparación de Herramientas

| Herramienta | Entrada | Salida | Propósito | Max Imágenes |
|-------------|---------|--------|-----------|--------------|
| Analizador IA | JPG, PNG, WebP | JSON + Metadatos | Análisis SEO | 20 |
| WEBP → PNG | WEBP | PNG | Convertir de web a estándar | 50 |
| JPG/PNG → WEBP | JPG, PNG | WEBP | Optimizar para web | 50 |

---

## Consejos de Uso

### Para Analizador de Imágenes
- Usa imágenes claras y de buena calidad
- Las imágenes se comprimen automáticamente
- Los títulos SEO son únicos por proyecto
- Descarga los metadatos en JSON para reutilizar

### Para Conversión WEBP → PNG
- Usa cuando necesites archivos PNG estándar
- Útil para compatibilidad con sistemas antiguos
- No hay pérdida de calidad

### Para Conversión JPG/PNG → WEBP
- Usa para optimizar imágenes web
- Ideal antes de subir imágenes a producción
- Ahorra ancho de banda y mejora velocidad de carga
- Calidad 80 es ideal para la mayoría de casos
