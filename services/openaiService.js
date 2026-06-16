const axios = require('axios');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

if (!OPENAI_API_KEY) {
  console.warn('⚠️  OPENAI_API_KEY not set in environment variables. OpenAI features will be disabled.');
}

/**
 * Generate a detailed prompt for the web designer based on lead information
 * @param {Object} leadData - Lead information from database
 * @param {Object} funnelData - Funnel phase 2 collected data
 * @returns {Promise<string>} Generated prompt
 */
async function generateDesignerPrompt(leadData, funnelData, options = {}) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured');
  }

  // Base system prompt in Spanish
  const baseSystemPrompt = `Eres un generador profesional de briefs para diseño web.
Tu tarea es crear un brief detallado y estructurado para un diseñador web basado en la información del cliente.
El brief debe ser completo, accionable y con un tono profesional.
Formatea la salida como una guía clara y jerárquica que un diseñador pueda seguir.`;

  // Optionally tweak prompts depending on industry/sector
  const sector = String((funnelData?.sector || '')).toLowerCase();
  let systemPrompt = baseSystemPrompt;
  if (sector.includes('restaur') || sector.includes('bar') || sector.includes('café') || sector.includes('cafe')) {
    systemPrompt = baseSystemPrompt + '\n\nNota: Prioriza menús, reservas, horarios y galería de imágenes; sugiere estructuras enfocadas en conversiones para restaurantes.';
  } else if (sector.includes('salón') || sector.includes('peluquer') || sector.includes('beaut') || sector.includes('spa')) {
    systemPrompt = baseSystemPrompt + '\n\nNota: Prioriza presentación de servicios, galería y sistema de citas; cuida la estética y el look & feel.';
  } else if (sector.includes('tienda') || sector.includes('e-commerce') || sector.includes('comercio')) {
    systemPrompt = baseSystemPrompt + '\n\nNota: Incluye recomendaciones sobre catálogo de productos, fichas, carrito, opciones de pago y búsqueda interna.';
  } else if (sector.includes('servicio') || sector.includes('consult') || sector.includes('aboga') || sector.includes('legal')) {
    systemPrompt = baseSystemPrompt + '\n\nNota: Prioriza claridad en servicios, llamadas a la acción y confianza (testimonios, casos de éxito).';
  }

  // Select prompt type: brief (default) or template (structured site plan)
  let chosenUserPrompt = '';
  if (options && options.template) {
    const tipo_negocio = funnelData?.sector || leadData.full_name || 'NEGOCIO';
    const foto_principal = (funnelData?.fotos_representativas || '').split(',')[0] || '{{foto_principal}}';
    const claim = (funnelData?.descripcion || '').split('.').slice(0,1).join('') || '{{claim}}';
    const descripcion_breve = funnelData?.descripcion || '{{descripcion_breve}}';
    const servicios_destacados = funnelData?.servicios || '{{servicios_destacados}}';
    const fotos_local = funnelData?.fotos_representativas || '{{fotos_local}}';
    const categorias = (funnelData?.servicios || '').split(',').slice(0,5).join(', ') || '{{categorias}}';
    const telefono = funnelData?.telefofo_contacto || leadData.phone || '{{telefono}}';
    const redes = funnelData?.redes_sociales || '{{redes_sociales}}';
    const direccion = funnelData?.direccion || '{{direccion}}';

    chosenUserPrompt = `Genera la plantilla detallada para el desarrollo web basada en los datos del lead. Sigue este esquema y rellena los campos con la información disponible. Si falta información, utiliza placeholders entre doble llaves. Mantén el texto en español.\n\n1) Alcance y objetivos\nObjetivo: web informativa con formulario de contacto y secciones básicas personalizadas según el tipo de negocio (${tipo_negocio}).\nDebe ser responsive, rápida y optimizada para SEO on-page.\nTech stack: HTML + CSS + JS + Bootstrap + PHP.\n\n2) Arquitectura de información\n1. Inicio (/)\nHero: foto del negocio (${foto_principal}) + claim corto (${claim}) + botones CTA.\n\nBloque destacado: breve descripción de la empresa (${descripcion_breve}) + 3–6 servicios o productos clave (${servicios_destacados}).\n\nFotos o galería: imágenes del local o equipo (${fotos_local}).\n\nMapa, horario, teléfono, redes sociales.\n\nNotas UX: Botón flotante “Llamar” y “WhatsApp” en móvil. Hero con overlay suave y tipografía legible.\n\n2. Página de Servicios o Productos (/servicios o /productos)\nListado de categorías (${categorias}).\n\n3. Contacto (/contacto)\nFormulario: nombre, teléfono, email, mensaje.\nAlternativas: botones “Llamar” (${telefono}) y redes sociales (${redes}).\nMapa y dirección (${direccion}).\n\n4. Panel privado (opcional, si aplica)\nAcceso mediante usuario/contraseña ({{credenciales_admin}}).\n\n3) Diseño (UI)\nEstilo general: coherente con el branding de ${leadData.full_name || '{{nombre_empresa}}'}.\nPaleta: {{color_primario}}, {{color_secundario}}, {{color_fondo}}, {{color_texto}}.\nTipografías y componentes según especificaciones.\n\n4) Contenidos (copy por bloques)\nInicio\nClaim principal: “${claim}”\nDescripción corta: “${descripcion_breve}”\nSección de servicios/productos: Lista de 3 a 6 elementos, con nombre, descripción y precio (si aplica).\nContacto: Teléfono: ${telefono} Email: ${leadData.email || '{{email}}'}\n\n5) SEO on-page y rendimiento\nURLs limpias: /, /servicios, /contacto.\nMetatags personalizadas por página.\nSchema.org según tipo de negocio (${funnelData?.sector || '{{schema_type}}'}).\n\n6) Pautas de implementación\nFrontend: HTML5 + Bootstrap + CSS propio + JS ligero.\nBackend: PHP + MySQL (si hay contenidos dinámicos).\n\n7) Accesibilidad y legales\nWCAG AA básica. Páginas legales: Aviso Legal, Privacidad, Cookies.\n\nDevuelve la plantilla completa en texto listo para usar.`;
  } else {
    chosenUserPrompt = `Basándote en la siguiente información del cliente, genera una plantilla detallada de brief de diseño web que pueda entregar a mi diseñador.\nMantén el enfoque y la estructura para que sirva como una guía detallada y autocontenida sobre cómo desarrollar el sitio web.\n\nINFORMACIÓN DEL CLIENTE:\n- Nombre del negocio: ${leadData.full_name || 'N/A'}\n- Sector: ${funnelData?.sector || 'N/A'}\n- Descripción: ${funnelData?.descripcion || 'N/A'}\n- Servicios/Productos: ${funnelData?.servicios || 'N/A'}\n- Preferencia de estilo web: ${funnelData?.estilo_web || 'N/A'}\n- Referencias visuales: ${funnelData?.referencias_visuales || 'N/A'}\n- Redes sociales/Contacto: ${funnelData?.redes_sociales || 'N/A'}\n- Dirección: ${funnelData?.direccion || 'N/A'}\n- Teléfono: ${funnelData?.telefofo_contacto || leadData.phone || 'N/A'}\n\nGenera un brief completo que incluya:\n1. Resumen del proyecto y descripción del cliente\n2. Identidad de marca y pautas visuales\n3. Estructura del sitio web y secciones\n4. Estrategia de contenidos\n5. Requisitos técnicos\n6. Dirección de diseño visual\n7. Consideraciones de experiencia de usuario\n8. Rendimiento y consideraciones SEO\n9. Entregables y cronograma\n\nHazlo profesional, detallado y listo para compartir con un diseñador.`;
  }

  try {
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: chosenUserPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data?.choices?.[0]?.message?.content) {
      const designerBrief = response.data.choices[0].message.content;
      // Build the Builder IO prompt wrapper in Spanish, embedding the generated brief as documentation
      const businessDescName = `${leadData.full_name || ''}${funnelData?.descripcion ? ' - ' + funnelData.descripcion : ''}`.trim();
      const builderPrompt = `Propmpt Builder IO:\n\nNecesito que me desarrolles una página web sobre el ${businessDescName || 'DESCRIPCIÓN_NEGOCIO'}.
Debes seguir al detalle todas las instrucciones y especificaciones acerca del desarrollo de la web que he plasmado en la documentación.\n\n-Analiza y comprende detalladamente los requisitos e instrucciones de la documentación.\n-Hazte un todolist de paso por paso cómo llevar a cabo el desarrollo de la web para que puedas cumplir todos los pasos y crear una web completa cumpliendo con todas las exigencias de la documentación.\n\nDocumentación:\n\n${designerBrief}`;

      return { designerBrief, builderPrompt };
    } else {
      throw new Error('Unexpected OpenAI response format');
    }
  } catch (error) {
    if (error.response?.data?.error?.message) {
      throw new Error(`OpenAI Error: ${error.response.data.error.message}`);
    }
    throw new Error(`Failed to generate prompt: ${error.message}`);
  }
}

async function parsePhase2Message(leadData, messages) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured');
  }

  // Compose system prompt for extraction
  const systemPrompt = `Eres un asistente que extrae información estructurada de mensajes de clientes en español.
Tu tarea es, dado un conjunto de mensajes recibidos de un contacto, extraer los siguientes campos si están presentes: sector, descripcion, servicios, estilo_web, referencias_visuales, fotos_representativas, direccion, telefofo_contacto, redes_sociales.
Devuelve exclusivamente un objeto JSON con esas claves (si falta un campo, usa cadena vacía).
Asegúrate de que la salida sea JSON válido.`;

  const combinedMessages = messages.map(m => `- [${m.direction || m.delivery_status || 'inbound'}] ${m.message_text || m.message || ''} (fecha: ${m.created_at || m.createdAt || ''})`).join('\n');
  const userPrompt = `Extrae la información solicitada de los siguientes mensajes del lead:\n\n${combinedMessages}`;

  try {
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0,
        max_tokens: 600
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const content = response.data?.choices?.[0]?.message?.content || '';
    // Try to extract JSON substring
    const match = content.match(/\{[\s\S]*\}/);
    const jsonText = match ? match[0] : content;
    let parsed = {};
    try { parsed = JSON.parse(jsonText); } catch (e) {
      // If parsing fails, return empty fields
      parsed = {
        sector: '', descripcion: '', servicios: '', estilo_web: '', referencias_visuales: '', fotos_representativas: '', direccion: '', telefofo_contacto: '', redes_sociales: ''
      };
    }

    // Ensure keys exist
    const keys = ['sector','descripcion','servicios','estilo_web','referencias_visuales','fotos_representativas','direccion','telefofo_contacto','redes_sociales'];
    const result = {};
    for (const k of keys) result[k] = parsed[k] || '';
    return result;
  } catch (err) {
    if (err.response?.data?.error?.message) {
      throw new Error(`OpenAI Error: ${err.response.data.error.message}`);
    }
    throw new Error(`Failed to parse messages: ${err.message}`);
  }
}

/**
 * Analyze an image and generate SEO metadata (title and description)
 * @param {string} base64Image - Base64 encoded image
 * @returns {Promise<Object>} Object with title and description
 */
async function analyzeImageForSEO(base64Image) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured');
  }

  const systemPrompt = `Eres un asistente experto en diseño web y SEO.
Analiza esta imagen y devuélveme SOLO un JSON válido con esta estructura exacta:

{
  "title": "nombre_seo_unico_para_archivo",
  "description": "descripción breve de lo que aparece en la imagen"
}

Reglas para el title:
- Debe ser un slug SEO en minúsculas, sin espacios (usa guiones bajos).
- NO puede contener números, códigos, IDs ni palabras genéricas como "imagen", "foto", "pic".
- Debe ser SEMÁNTICO y DESCRIPTIVO, combinando siempre estos 3 elementos:
  1) tipo de negocio o contexto (ej: masaje_tailandes, clinica_dental, cafeteria_artesanal)
  2) elemento o espacio principal visible (ej: cabina_relax, zona_trabajo, fachada_local)
  3) un matiz único o detalle visual que ayude a diferenciarlo (ej: luz_calida, pared_madera, decoracion_flores)

Reglas generales:
- El title debe ser lo suficientemente descriptivo como para NO repetirse en ningún proyecto.
- La description debe explicar el contenido de la imagen de forma profesional y breve.
- Devuelve SOLO el JSON, sin markdown, sin texto adicional.`;

  try {
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: systemPrompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        temperature: 0.7,
        max_tokens: 200
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const content = response.data?.choices?.[0]?.message?.content || '';

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;

    let result = {
      title: 'imagen_sin_titulo',
      description: 'Sin descripción disponible'
    };

    try {
      const parsed = JSON.parse(jsonStr);
      result.title = parsed.title || result.title;
      result.description = parsed.description || result.description;
    } catch (parseError) {
      console.warn('Failed to parse JSON response from OpenAI:', parseError);
    }

    return result;
  } catch (error) {
    if (error.response?.data?.error?.message) {
      throw new Error(`OpenAI Error: ${error.response.data.error.message}`);
    }
    throw new Error(`Failed to analyze image: ${error.message}`);
  }
}

module.exports = {
  generateDesignerPrompt,
  parsePhase2Message,
  analyzeImageForSEO,
};
