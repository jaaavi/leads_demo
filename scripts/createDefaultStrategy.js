const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = require('../db/config');

const DEFAULT_STRATEGY_NAME = 'Estrategia Estándar';
const DEFAULT_STRATEGY_DESCRIPTION = 'Estrategia por defecto con los mensajes estándar del sistema';

const DEFAULT_MESSAGES = {
  // Phase 1 - Opening Messages
  NATURAL: `¡Hola! Soy Javier

Estoy montando una pequeña agencia de diseño de páginas web y estamos ofreciendo a los negocios de la zona la posibilidad de crear una previsualización gratuita de cómo quedaría su web antes de decidir nada.

¿Os gustaría que os preparemos una propuesta visual sin compromiso?`,

  CORTA: `¡Hola! Soy Javier, diseñador web de aquí del barrio.

Hemos visto que vuestro negocio no tiene web y nos gustaría ofreceros una previsualización gratuita para que veáis cómo podría quedar.

¿Queréis que os la preparemos sin compromiso?`,

  AGENCIA: `¡Hola! Soy Javier

En nuestra agencia estamos ofreciendo a los negocios de la zona la oportunidad de ver cómo quedaría su web profesional, sin compromiso ni coste.

¿Os parece bien que os preparemos una propuesta visual?`,

  PERSONAL: `¡Hola! Soy Javier, soy diseñador web y vivo por aquí cerca.

He visto que ahora mismo no tenéis página web, y me encantaría enseñárosla cómo podría quedar creando una previsualización gratuita.

Si preferís, puedo pasarme un minuto y enseñárosla en persona, así lo veis sin compromiso.

¿Os parece bien que os la preparemos?`,

  // Phase 2 - Recopilacion
  RECOPILACION: `¡Genial!  Me alegra que os interese.

Lo único que necesitamos para poder preparar la previsualización y que refleje bien vuestro estilo y contenido es lo siguiente:

{lista_requisitos}

Con eso, os preparamos la previsualización personalizada y en unos 3 días os la podemos enseñar sin compromiso.`,

  // Phase 4 - Preview Messages
  PREVISUALIZACION: `Buenas,
Ya tenemos lista la previsualización de vuestra web😄
Si queréis, puedo enviárosla por aquí para que la veáis tranquilos, o si preferís, puedo pasarme un momento y enseñárosla en persona, así os explico cómo funcionaría (sin ningún compromiso).
¿Qué os viene mejor?

`,

  CLIENTE_BASICO: `Cliente Básico

Objetivo:
Convertir a alguien que pensaba no gastar nada, mostrándole que puede tener una web real y cuidada sin esfuerzo.

Propuesta: Web básica personalizada
"Si buscas algo sencillo, podemos dejar esta misma base adaptándola con vuestros textos, colores y fotos reales.y en menos de una semana estaría publicada."

"Incluiríamos además vuestro dominio, hosting, email profesional y la optimización para que aparezcáis bien en Google Maps."

Incluye:
- landing page con tus secciones principales (inicio, servicios, contacto).
- Adaptación visual con tu identidad.
- Optimización SEO local básica.
- Hosting + dominio + email

Precio orientativo: 250–400 € / mantenimiento mensual 15–25 €/mes`,

  CLIENTE_INTERESADO: `Cliente Interesado

Objetivo:
Aprovechar su interés para ofrecerle una web más completa, pero sin que sienta que le estás subiendo el precio sin razón.

Propuesta: Web personalizada + optimizada
"Podemos partir de esta base y adaptarla por completo a vuestro negocio: colores, fotos, secciones, textos, todo ajustado a vuestra imagen."

"También podemos añadir secciones nuevas (Carta, Servicios, Galería, Reservas, Blog…) y dejarla lista para posicionar en Google."

Incluye:
- Hasta 4–6 páginas personalizadas.
- Diseño ajustado al branding real.
- Formularios, reservas o integración de redes.
- Optimización SEO on-page.
- Hosting + dominio + mail + mantenimiento

Precio orientativo: 600–900 %.`,

  CLIENTE_AMBICIOSO: `Cliente Ambicioso

Objetivo:
Posicionarte como agencia profesional, no freelance barato.

Propuesta: Web profesional y escalable
"Podemos desarrollar una web completa, partiendo de esta base visual, pero estructurada para crecer: con panel de gestión, posicionamiento SEO, posibilidad de multilenguaje o integración de sistemas externos (reservas, CRM, catálogo…)."

"Base sólida para crecer online y atraer clientes de forma profesional."

Incluye:
- 6–10 páginas profesionales.
- Panel de edición o CMS básico (para cambiar contenidos).
- SEO avanzado + analítica.
- Integraciones (reserva, formulario avanzado, etc.).
- Diseño a medida.

Precio orientativo: 1.000–1.800 €.`
};

async function createDefaultStrategy() {
  const conn = await pool.getConnection();
  try {
    // Check if default strategy already exists
    const [existing] = await conn.execute(
      'SELECT id FROM strategies WHERE name = ?',
      [DEFAULT_STRATEGY_NAME]
    );

    let strategyId;

    if (existing.length > 0) {
      strategyId = existing[0].id;
      console.log(`✓ Default strategy already exists with ID: ${strategyId}`);
    } else {
      // Create default strategy
      const [result] = await conn.execute(
        'INSERT INTO strategies (name, description, is_active) VALUES (?, ?, 1)',
        [DEFAULT_STRATEGY_NAME, DEFAULT_STRATEGY_DESCRIPTION]
      );
      strategyId = result.insertId;
      console.log(`✓ Default strategy created with ID: ${strategyId}`);
    }

    // Deactivate all other strategies
    await conn.execute('UPDATE strategies SET is_active = 0 WHERE id != ?', [strategyId]);

    // Add/update messages for the default strategy
    for (const [messageType, content] of Object.entries(DEFAULT_MESSAGES)) {
      // Check if message already exists
      const [existing] = await conn.execute(
        'SELECT id FROM strategy_messages WHERE strategy_id = ? AND message_type = ?',
        [strategyId, messageType]
      );

      if (existing.length > 0) {
        // Update existing message
        await conn.execute(
          'UPDATE strategy_messages SET content = ? WHERE strategy_id = ? AND message_type = ?',
          [content, strategyId, messageType]
        );
        console.log(`  ✓ Updated message: ${messageType}`);
      } else {
        // Insert new message
        await conn.execute(
          'INSERT INTO strategy_messages (strategy_id, message_type, content, phase) VALUES (?, ?, ?, 1)',
          [strategyId, messageType, content]
        );
        console.log(`  ✓ Created message: ${messageType}`);
      }
    }

    console.log('\n✓ Default strategy initialization completed!');
    return strategyId;
  } catch (err) {
    console.error('✗ Error creating default strategy:', err);
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { createDefaultStrategy };
