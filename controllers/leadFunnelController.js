const {
  initializeFunnel,
  getFunnelStatus,
  updateOpeningMessage,
  updatePhase2Data,
  createPhase3Prompt,
  updatePhase4Preview: updatePhase4PreviewModel,
  markPhase4MessageSent,
  getLeadsWithFunnelStatus,
  setPhaseFlag,
} = require('../models/leadFunnelModel');
const { getLeadById } = require('../models/leadModel');
const { generateDesignerPrompt } = require('../services/openaiService');
const { sendMessage: sendWhatsAppMessage, getSessionStatus } = require('../services/whatsappService');
const { interpolateTemplate, getLeadMessages, createMessage } = require('../models/whatsappModel');

const INSTANCE_ID = process.env.WHATSAPP_INSTANCE_ID || 'main-bot';

async function resolveInstanceForLead(lead, senderUserId = null) {
  try {
    const { getUserById } = require('../models/userModel');

    // 1) If sender has a personal instance, prefer it
    if (senderUserId) {
      try {
        const sender = await getUserById(senderUserId);
        if (sender && sender.whatsapp_instance_id) return sender.whatsapp_instance_id;
        // If sender is admin and no personal instance, allow using global INSTANCE_ID
        if (sender && sender.role === 'admin') return INSTANCE_ID;
      } catch (e) { /* ignore */ }
    }

    // 2) If lead has assigned user with personal instance, use it
    if (lead && lead.assigned_to) {
      const user = await getUserById(lead.assigned_to);
      if (user && user.whatsapp_instance_id) return user.whatsapp_instance_id;
    }

    // 3) No personal instance found — do not fallback to global for non-admin senders
    return null;
  } catch (e) {
    return null;
  }
}

// Normalize phone for WhatsApp: prefer explicit country prefix (+..), support 00 prefix, or fall back to DEFAULT_COUNTRY_CODE env var for mobile phones only
function normalizePhoneForWhatsApp(rawPhone, phoneType = 'mobile') {
  if (!rawPhone) throw new Error('Phone is required');
  let s = String(rawPhone).trim();
  if (!s) throw new Error('Phone is empty');
  s = s.replace(/[\s\-().]/g, '');

  if (s.startsWith('+')) {
    const digits = s.replace(/\D/g, '');
    if (digits.length < 6) throw new Error('Phone number too short');
    return digits;
  }

  if (s.startsWith('00')) {
    const digits = s.replace(/^00/, '').replace(/\D/g, '');
    if (digits.length < 6) throw new Error('Phone number too short');
    return digits;
  }

  // Only apply default country code for mobile phones
  if (phoneType === 'mobile' || phoneType === 'movil') {
    const defaultCode = process.env.DEFAULT_COUNTRY_CODE || null; // e.g. '+34'
    if (!defaultCode) {
      throw new Error('Phone number does not include country prefix. Please provide number in international format (e.g. +34...)');
    }
    const codeDigits = String(defaultCode).replace(/\D/g, '');
    const digits = s.replace(/\D/g, '');
    if (!codeDigits) throw new Error('Invalid DEFAULT_COUNTRY_CODE');
    const result = codeDigits + digits;
    if (result.length < 6) throw new Error('Phone number too short after applying country code');
    return result;
  }

  // For fixed line or unknown type, just clean digits without adding prefix
  const digits = s.replace(/\D/g, '');
  if (digits.length < 6) throw new Error('Phone number too short');
  return digits;
}

// Opening messages templates
const OPENING_MESSAGES = {
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
He visto que ahora mismo no tenéis página web, y me encantaría enseñaros cómo podría quedar creando una previsualización gratuita.
Si preferís, puedo pasarme un minuto y enseñárosla en persona, así lo veis sin compromiso.
¿Os parece bien que os la preparemos?`,
};

const PHASE_2_MESSAGE = `¡Genial!  Me alegra que os interese.

Lo único que necesitamos para poder preparar la previsualización y que refleje bien vuestro estilo y contenido es lo siguiente:

{lista_requisitos}

Con eso, os preparamos la previsualización personalizada y en unos 3 días os la podemos enseñar sin compromiso.
`;

const PHASE_4_MESSAGE = `Buenas,
Ya tenemos lista la previsualización de vuestra web😄
Si queréis, puedo enviárosla por aquí para que la veáis tranquilos, o si preferís, puedo pasarme un momento y enseñárosla en persona, así os explico cómo funcionaría (sin ningún compromiso).
¿Qué os viene mejor?`;

// Initialize funnel for a lead
async function initFunnel(req, res) {
  try {
    const leadId = Number(req.params.leadId);
    const lead = await getLeadById(leadId);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    await initializeFunnel(leadId);
    const status = await getFunnelStatus(leadId);

    res.json({ ok: true, status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Get funnel status for a lead
async function getFunnel(req, res) {
  try {
    const leadId = Number(req.params.leadId);
    const lead = await getLeadById(leadId);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    let status = await getFunnelStatus(leadId);
    if (!status) {
      await initializeFunnel(leadId);
      status = await getFunnelStatus(leadId);
    }

    // Get active strategy and its messages
    let strategy = null;
    let strategyMessages = {};
    try {
      const { getActiveStrategy, getStrategyMessages } = require('../models/strategyModel');
      const activeStrategy = await getActiveStrategy();
      if (activeStrategy) {
        strategy = activeStrategy;
        const messages = await getStrategyMessages(activeStrategy.id);
        strategyMessages = {};
        messages.forEach(msg => {
          strategyMessages[msg.message_type] = msg.content;
        });
      }
    } catch (e) {
      console.warn('Could not load active strategy:', e.message);
    }

    res.json({ ok: true, status, lead, strategy, strategyMessages });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Send opening message (Phase 1)
async function sendOpeningMessage(req, res) {
  try {
    const leadId = Number(req.params.leadId);
    const { messageType, partText, partIndex, isLastPart, sendAll } = req.body || {};

    if (!messageType || !OPENING_MESSAGES[messageType]) {
      return res.status(400).json({ error: 'Invalid message type' });
    }

    const lead = await getLeadById(leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Resolve the instance for this lead (sender personal instance, assigned user, or admin global)
    const instanceId = await resolveInstanceForLead(lead, req.session?.userId || null);
    const whatsappStatus = await getSessionStatus(instanceId);
    if (!instanceId) {
      return res.status(400).json({ error: 'Debes conectar tu WhatsApp.' });
    }
    if (!whatsappStatus.connected) {
      return res.status(400).json({ error: 'Debes conectar tu WhatsApp.' });
    }

    const fullMessageText = OPENING_MESSAGES[messageType];
    const textToSend = partText && String(partText).trim() ? String(partText) : fullMessageText;

    let externalMsgId = null;
    try {
      const normalizedPhone = normalizePhoneForWhatsApp(lead.phone, lead.phone_type);
      const sentRes = await sendWhatsAppMessage(instanceId, normalizedPhone, textToSend);
      try { externalMsgId = sentRes?.key?.id || sentRes?.id || null; } catch (e) { externalMsgId = null; }

      try {
        await createMessage({ instanceId: instanceId, leadId: leadId, recipientPhone: normalizedPhone, messageText: textToSend, messageType: 'text', direction: 'outbound', externalMessageId: externalMsgId });
      } catch (e) {
        console.warn('Warning: could not create whatsapp_messages record for opening message part:', e.message);
      }
    } catch (e) {
      return res.status(400).json({ error: 'Failed to send WhatsApp message: ' + e.message });
    }

    // If sending entire message at once or this is the last part, mark opening message as sent
    if (sendAll || isLastPart) {
      await updateOpeningMessage(leadId, messageType, true);
      try {
        const { events } = require('../services/whatsappService');
        const status2 = await getFunnelStatus(leadId);
        events.emit('funnel.update', { leadId, status: status2 });
      } catch (e) { console.warn('Could not emit funnel.update', e.message); }
    }

    const status = await getFunnelStatus(leadId);
    res.json({ ok: true, message: 'Opening message part sent', status, sent: { partIndex: partIndex || null, isLastPart: !!isLastPart } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Update Phase 2 data and send phase 2 message
async function updatePhase2(req, res) {
  try {
    const leadId = Number(req.params.leadId);
    const data = req.body;

    const lead = await getLeadById(leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Only persist and advance phase when actual form fields are being saved, not when just sending messages
    const formKeys = ['sector','descripcion','servicios','redes_sociales','fotos_representativas','estilo_web','referencias_visuales','direccion','telefofo_contacto'];
    const hasFormData = data && Object.keys(data).some(k => formKeys.includes(k));
    if (hasFormData) {
      await updatePhase2Data(leadId, data);
    }

    // Optionally send phase 2 message (interpolated with lead + funnel data)
    const instanceId = await resolveInstanceForLead(lead, req.session?.userId || null);
    const whatsappStatus = await getSessionStatus(instanceId);
    if (!instanceId) {
      // no instance associated -> do not send
      if (data.sendMessage || data.sendParts || data.overrideText || data.parts) {
        return res.status(400).json({ error: 'Debes conectar tu WhatsApp.' });
      }
    }
    if (whatsappStatus.connected && (data.sendMessage || data.sendParts || data.overrideText || data.parts)) {
      try {
        const status = await getFunnelStatus(leadId);
        const combined = Object.assign({}, lead, status?.data || {}, data);
        // Provide list of requirements text (bullet/dotted style for WhatsApp)
        const lista = `• Una frase que defina lo que ofrecéis o lo que os diferencia\n• Vuestros servicios o productos principales\n• Redes sociales o alguna foto que os represente (si tenéis)\n• Estilo que os gustaría para la web: moderna, limpia, acogedora, profesional, elegante.. Si tenéis alguna web o diseño de referencia también nos sirve.`;
        let msgTemplate = PHASE_2_MESSAGE.replace('{lista_requisitos}', lista);

        // If overrideText provided by client, use it
        let messageFull = (data.overrideText && String(data.overrideText).trim()) ? String(data.overrideText) : msgTemplate;

        // Interpolate template variables with lead+funnel data
        let interpolated = await interpolateTemplate(messageFull, combined);

        const normalizedPhone = normalizePhoneForWhatsApp(lead.phone, lead.phone_type);

        // Determine parts: explicit array, or split by blank line if sendParts true
        let partsToSend = [];
        if (Array.isArray(data.parts) && data.parts.length) {
          partsToSend = data.parts.map(p => String(p || '').trim()).filter(Boolean);
        } else if (data.sendParts) {
          partsToSend = interpolated.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
          if (!partsToSend.length) partsToSend = interpolated.split(/\n/).map(s => s.trim()).filter(Boolean);
        }

        if (partsToSend.length) {
          const delayMs = Number(data.sendPartsDelayMs || 0) || (data.humanize ? 1500 : 0);
          for (let i = 0; i < partsToSend.length; i++) {
            const textPart = partsToSend[i];
            try {
              const sentRes = await sendWhatsAppMessage(instanceId, normalizedPhone, textPart);
              const externalMsgId = sentRes?.key?.id || sentRes?.id || null;
              try { await createMessage({ instanceId: instanceId, leadId, recipientPhone: normalizedPhone, messageText: textPart, messageType: 'text', direction: 'outbound', externalMessageId: externalMsgId }); } catch (e) { console.warn('Could not persist part message:', e.message); }
              if (delayMs > 0 && i < partsToSend.length - 1) {
                await new Promise(r => setTimeout(r, delayMs));
              }
            } catch (e) {
              console.error('Failed to send Phase 2 message part:', e.message);
            }
          }
        } else if (data.sendMessage) {
          try {
            const sentRes = await sendWhatsAppMessage(instanceId, normalizedPhone, interpolated);
            const externalMsgId = sentRes?.key?.id || sentRes?.id || null;
            try { await createMessage({ instanceId: instanceId, leadId, recipientPhone: normalizedPhone, messageText: interpolated, messageType: 'text', direction: 'outbound', externalMessageId: externalMsgId }); } catch (e) { console.warn('Could not persist phase2 message:', e.message); }
          } catch (e) {
            console.error('Failed to send Phase 2 message:', e.message);
          }
        }
      } catch (e) {
        console.error('Failed to send Phase 2 message:', e.message);
      }
    }

    const status = await getFunnelStatus(leadId);
    // Emit funnel update ONLY when form data saved (avoid jumping phase on sending parts)
    if (hasFormData) {
      try { const { events } = require('../services/whatsappService'); events.emit('funnel.update', { leadId, status }); } catch (e) { console.warn('Could not emit funnel.update', e.message); }
    }
    res.json({ ok: true, message: 'Phase 2 data updated', status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Parse Phase 2 from incoming messages using OpenAI
async function parsePhase2FromMessages(req, res) {
  try {
    const leadId = Number(req.params.leadId);
    const lead = await getLeadById(leadId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    // Ensure funnel exists and get opening message timestamp
    const status = await getFunnelStatus(leadId);
    const openingAt = status?.phase?.opening_message_sent_at || status?.phase?.opening_message_sent || null;

    // Fetch recent messages and filter inbound replies (after opening message if available)
    const msgs = await getLeadMessages(leadId);
    const inbound = msgs.filter(m => (m.direction && m.direction !== 'outbound') || (m.delivery_status && m.delivery_status === 'received'))
      .filter(m => {
        if (!openingAt) return true;
        const mDate = new Date(m.created_at);
        const oDate = new Date(openingAt);
        return mDate >= oDate;
      });

    if (!inbound.length) {
      return res.status(400).json({ error: 'No inbound replies found for this lead after the opening message' });
    }

    // Use OpenAI to extract structured fields
    const { parsePhase2Message } = require('../services/openaiService');
    const parsed = await parsePhase2Message(lead, inbound);

    // Save parsed data into phase 2
    await updatePhase2Data(leadId, Object.assign({}, parsed));

    const updatedStatus = await getFunnelStatus(leadId);

    // Emit funnel update event for real-time UI refresh
    try {
      const { events } = require('../services/whatsappService');
      events.emit('funnel.update', { leadId, status: updatedStatus });
    } catch (e) { console.warn('Could not emit funnel.update', e.message); }

    res.json({ ok: true, parsed, status: updatedStatus });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Generate Phase 3 prompt using OpenAI
async function generatePhase3Prompt(req, res) {
  try {
    const leadId = Number(req.params.leadId);
    const lead = await getLeadById(leadId);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const status = await getFunnelStatus(leadId);
    if (!status?.data) {
      return res.status(400).json({ error: 'Please complete Phase 2 first' });
    }

    try {
      const mode = (req.body && req.body.mode) || (req.query && req.query.mode) || 'brief';
      const options = { template: mode === 'template' };
      const result = await generateDesignerPrompt(lead, status.data, options);
      // result may contain { designerBrief, builderPrompt }
      let promptToStore = null;
      let responsePayload = null;

      if (typeof result === 'string') {
        // Backwards compatibility: older function returned a string (designer brief)
        promptToStore = result;
        responsePayload = { designer: result, builder: null };
      } else if (result && result.designerBrief) {
        promptToStore = result.designerBrief;
        responsePayload = { designer: result.designerBrief, builder: result.builderPrompt || null };
      } else {
        throw new Error('Unexpected prompt generation result');
      }

      await createPhase3Prompt(leadId, promptToStore, req.session?.userId || null);

      const updatedStatus = await getFunnelStatus(leadId);

      // Emit funnel update event for real-time UI refresh
      try {
        const { events } = require('../services/whatsappService');
        events.emit('funnel.update', { leadId, status: updatedStatus });
      } catch (e) { console.warn('Could not emit funnel.update', e.message); }

      res.json({ ok: true, prompt: responsePayload, status: updatedStatus });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Update Phase 4 preview URL
async function updatePhase4Preview(req, res) {
  try {
    const leadId = Number(req.params.leadId);
    const { previewUrl } = req.body;

    if (!previewUrl) {
      return res.status(400).json({ error: 'Preview URL is required' });
    }

    const lead = await getLeadById(leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    await updatePhase4PreviewModel(leadId, previewUrl);
    const status = await getFunnelStatus(leadId);

    // Emit funnel update event for real-time UI refresh
    try {
      const { events } = require('../services/whatsappService');
      events.emit('funnel.update', { leadId, status });
    } catch (e) { console.warn('Could not emit funnel.update', e.message); }

    res.json({ ok: true, message: 'Preview URL updated', status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Send Phase 4 closing message (supports multiple message types)
async function sendPhase4Message(req, res) {
  try {
    const leadId = Number(req.params.leadId);
    const { messageType, overrideText, sendParts, isLastPart, sendAll } = req.body || {};
    const lead = await getLeadById(leadId);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const instanceId = await resolveInstanceForLead(lead, req.session?.userId || null);
    const whatsappStatus = await getSessionStatus(instanceId);
    if (!instanceId) {
      return res.status(400).json({ error: 'Debes conectar tu WhatsApp.' });
    }
    if (!whatsappStatus.connected) {
      return res.status(400).json({ error: 'Debes conectar tu WhatsApp.' });
    }

    const status = await getFunnelStatus(leadId);
    const previewUrl = status?.phase?.phase_4_preview_url;

    // Define available Phase 4 messages
    const PHASE4_MESSAGES = {
      PREVISUALIZACION: `Buenas,\nYa tenemos lista la previsualización de vuestra web😄\nSi queréis, puedo enviárosla por aquí para que la veáis tranquilos, o si preferís, puedo pasarme un momento y enseñárosla en persona, así os explico cómo funcionaría (sin ningún compromiso).\n¿Qué os viene mejor?\n\n`,

      CLIENTE_BASICO: `Cliente Básico\n\nObjetivo:\nConvertir a alguien que pensaba no gastar nada, mostrándole que puede tener una web real y cuidada sin esfuerzo.\n\nPropuesta: Web básica personalizada\n\“Si buscas algo sencillo, podemos dejar esta misma base adaptándola con vuestros textos, colores y fotos reales.y en menos de una semana estaría publicada.\”\n\n\“Incluiríamos además vuestro dominio, hosting, email profesional y la optimización para que aparezcáis bien en Google Maps.\”\n\nIncluye:\n- landing page con tus secciones principales (inicio, servicios, contacto).\n- Adaptación visual con tu identidad.\n- Optimización SEO local básica.\n- Hosting + dominio + email\n\nPrecio orientativo: 250–400 € / mantenimiento mensual 15–25 €/mes`,

      CLIENTE_INTERESADO: `Cliente Interesado\n\nObjetivo:\nAprovechar su interés para ofrecerle una web más completa, pero sin que sienta que le estás subiendo el precio sin razón.\n\nPropuesta: Web personalizada + optimizada\n\“Podemos partir de esta base y adaptarla por completo a vuestro negocio: colores, fotos, secciones, textos, todo ajustado a vuestra imagen.\”\n\n\“También podemos añadir secciones nuevas (Carta, Servicios, Galería, Reservas, Blog…) y dejarla lista para posicionar en Google.\”\n\nIncluye:\n- Hasta 4–6 páginas personalizadas.\n- Diseño ajustado al branding real.\n- Formularios, reservas o integración de redes.\n- Optimización SEO on-page.\n- Hosting + dominio + mail + mantenimiento\n\nPrecio orientativo: 600–900 %.`,

      CLIENTE_AMBICIOSO: `Cliente Ambicioso\n\nObjetivo:\nPosicionarte como agencia profesional, no freelance barato.\n\nPropuesta: Web profesional y escalable\n\“Podemos desarrollar una web completa, partiendo de esta base visual, pero estructurada para crecer: con panel de gestión, posicionamiento SEO, posibilidad de multilenguaje o integración de sistemas externos (reservas, CRM, catálogo…).\”\n\n\“Base sólida para crecer online y atraer clientes de forma profesional.\”\n\nIncluye:\n- 6–10 páginas profesionales.\n- Panel de edición o CMS básico (para cambiar contenidos).\n- SEO avanzado + analítica.\n- Integraciones (reserva, formulario avanzado, etc.).\n- Diseño a medida.\n\nPrecio orientativo: 1.000–1.800 €.`,
    };

    // Select message based on requested type or default to preview message
    let messageText = PHASE4_MESSAGES[messageType] || PHASE4_MESSAGES.PREVISUALIZACION || PHASE_4_MESSAGE;

    // If overrideText provided by client (edited preview), use it
    if (overrideText && String(overrideText).trim()) {
      messageText = String(overrideText);
    }

    // Replace preview placeholder if needed
    if (previewUrl) {
      messageText = messageText.replace(/\{url_demo\}/g, previewUrl);
    }

    // Interpolate with lead + funnel data
    const combined = Object.assign({}, lead, status?.data || {});
    try {
      messageText = await interpolateTemplate(messageText, combined);
    } catch (e) {
      // interpolation errors should not block sending
      console.warn('Interpolation failed for Phase 4 message:', e.message);
    }

    let externalMsgId = null;
    try {
      const normalizedPhone = normalizePhoneForWhatsApp(lead.phone, lead.phone_type);

      // Determine parts: if sendParts true, split the message
      let partsToSend = [];
      if (sendParts) {
        partsToSend = messageText.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
        if (!partsToSend.length) partsToSend = messageText.split(/\n/).map(s => s.trim()).filter(Boolean);
      }

      if (partsToSend.length) {
        for (let i = 0; i < partsToSend.length; i++) {
          const textPart = partsToSend[i];
          try {
            const sentRes = await sendWhatsAppMessage(instanceId, normalizedPhone, textPart);
            const externalId = sentRes?.key?.id || sentRes?.id || null;
            try {
              await createMessage({ instanceId: instanceId, leadId: leadId, recipientPhone: normalizedPhone, messageText: textPart, messageType: 'text', direction: 'outbound', externalMessageId: externalId });
            } catch (e) {
              console.warn('Could not persist part message:', e.message);
            }
          } catch (e) {
            console.error('Failed to send Phase 4 message part:', e.message);
          }
        }
      } else {
        const sentRes = await sendWhatsAppMessage(instanceId, normalizedPhone, messageText);
        try { externalMsgId = sentRes?.key?.id || sentRes?.id || null; } catch (e) { externalMsgId = null; }
        try {
          await createMessage({ instanceId: instanceId, leadId: leadId, recipientPhone: normalizedPhone, messageText, messageType: 'text', direction: 'outbound', externalMessageId: externalMsgId });
        } catch (e) {
          console.warn('Warning: could not create whatsapp_messages record for phase4 message:', e.message);
        }
      }
    } catch (e) {
      return res.status(400).json({ error: 'Failed to send WhatsApp message: ' + e.message });
    }

    // Mark phase 4 as message sent (only if sendAll or isLastPart, or if not sending parts)
    if (sendAll || isLastPart || !sendParts) {
      await markPhase4MessageSent(leadId);
    }
    const updatedStatus = await getFunnelStatus(leadId);

    // Emit funnel update event for SSE clients
    try {
      const { events } = require('../services/whatsappService');
      events.emit('funnel.update', { leadId, status: updatedStatus });
    } catch (e) { console.warn('Could not emit funnel.update', e.message); }

    res.json({ ok: true, message: 'Phase 4 message sent', status: updatedStatus });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Send Phase 3 generated prompt to lead (supports override and multipart)
async function sendPhase3Message(req, res) {
  try {
    const leadId = Number(req.params.leadId);
    const { overrideText, sendParts, parts } = req.body || {};
    const lead = await getLeadById(leadId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const instanceId = await resolveInstanceForLead(lead, req.session?.userId || null);
    if (!instanceId) return res.status(400).json({ error: 'Debes conectar tu WhatsApp.' });
    const whatsappStatus = await getSessionStatus(instanceId);
    if (!whatsappStatus.connected) return res.status(400).json({ error: 'Debes conectar tu WhatsApp.' });

    const status = await getFunnelStatus(leadId);
    const promptRecord = status?.lastPrompt;
    let messageFull = '';

    if (overrideText && String(overrideText).trim()) {
      messageFull = String(overrideText);
    } else if (promptRecord && promptRecord.prompt_content) {
      messageFull = promptRecord.prompt_content;
    } else {
      return res.status(400).json({ error: 'No prompt available to send. Generate Phase 3 prompt first.' });
    }

    // Interpolate
    const combined = Object.assign({}, lead, status?.data || {});
    try { messageFull = await interpolateTemplate(messageFull, combined); } catch (e) { console.warn('Interpolation failed for Phase3 message:', e.message); }

    const normalizedPhone = normalizePhoneForWhatsApp(lead.phone, lead.phone_type);

    let partsToSend = [];
    if (Array.isArray(parts) && parts.length) partsToSend = parts.map(p => String(p || '').trim()).filter(Boolean);
    else if (sendParts) {
      partsToSend = messageFull.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
      if (!partsToSend.length) partsToSend = messageFull.split(/\n/).map(s => s.trim()).filter(Boolean);
    }

    if (partsToSend.length) {
      for (let i = 0; i < partsToSend.length; i++) {
        const textPart = partsToSend[i];
        try {
          const sentRes = await sendWhatsAppMessage(instanceId, normalizedPhone, textPart);
          const externalMsgId = sentRes?.key?.id || sentRes?.id || null;
          try { await createMessage({ instanceId: instanceId, leadId, recipientPhone: normalizedPhone, messageText: textPart, messageType: 'text', direction: 'outbound', externalMessageId: externalMsgId }); } catch (e) { console.warn('Could not persist part message:', e.message); }
        } catch (e) {
          console.error('Failed to send Phase 3 message part:', e.message);
        }
      }
    } else {
      try {
        const sentRes = await sendWhatsAppMessage(instanceId, normalizedPhone, messageFull);
        const externalMsgId = sentRes?.key?.id || sentRes?.id || null;
        try { await createMessage({ instanceId: instanceId, leadId, recipientPhone: normalizedPhone, messageText: messageFull, messageType: 'text', direction: 'outbound', externalMessageId: externalMsgId }); } catch (e) { console.warn('Could not persist phase3 message:', e.message); }
      } catch (e) {
        return res.status(400).json({ error: 'Failed to send Phase 3 message: ' + e.message });
      }
    }

    // Emit funnel update
    try { const { events } = require('../services/whatsappService'); const updated = await getFunnelStatus(leadId); events.emit('funnel.update', { leadId, status: updated }); } catch (e) { console.warn('Could not emit funnel.update', e.message); }

    const updatedStatus = await getFunnelStatus(leadId);
    res.json({ ok: true, message: 'Phase 3 message sent', status: updatedStatus });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function togglePhaseCompletion(req, res) {
  try {
    const leadId = Number(req.params.leadId);
    const phase = Number(req.params.phase);
    const { completed } = req.body;

    const lead = await getLeadById(leadId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const map = {
      1: 'opening_message_sent',
      2: 'phase_2_completed',
      3: 'phase_3_prompt_generated',
      4: 'phase_4_message_sent'
    };

    const field = map[phase];
    if (!field) return res.status(400).json({ error: 'Invalid phase' });

    await setPhaseFlag(leadId, field, !!completed);
    const status = await getFunnelStatus(leadId);

    // Emit funnel update event for real-time UI refresh
    try {
      const { events } = require('../services/whatsappService');
      events.emit('funnel.update', { leadId, status });
    } catch (e) { console.warn('Could not emit funnel.update', e.message); }

    res.json({ ok: true, status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = {
  initFunnel,
  getFunnel,
  sendOpeningMessage,
  updatePhase2,
  parsePhase2FromMessages,
  generatePhase3Prompt,
  sendPhase3Message,
  updatePhase4Preview,
  sendPhase4Message,
  togglePhaseCompletion,
};
