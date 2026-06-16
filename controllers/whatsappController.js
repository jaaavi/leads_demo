const { getOrCreateSession, updateSessionQR, updateSessionConnected, getSession, getAllSessions, createMessage, getLeadMessages, updateMessageStatus, getTemplates, createTemplate, deleteTemplate, interpolateTemplate } = require('../models/whatsappModel');
const { getLeadById } = require('../models/leadModel');
const { initSession, getQRCode: getQRFromService, sendMessage: sendWhatsAppMessage, getSessionStatus, disconnectSession } = require('../services/whatsappService');

const INSTANCE_ID = process.env.WHATSAPP_INSTANCE_ID || 'main-bot';

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

async function getQRCode(req, res) {
  try {
    // Determine instance: if user has a personal instance, use it; else use global
    const userId = req.session?.userId || null;
    let instanceId = INSTANCE_ID;

    if (userId) {
      const { getUserById, setUserWhatsappInstance } = require('../models/userModel');
      const user = await getUserById(userId);

      // For comercial_pro users: do NOT expose global/admin instance.
      // If they don't have a personal instance, create one automatically so they can scan the QR.
      if (user && user.role === 'comercial_pro') {
        if (user.whatsapp_instance_id) {
          instanceId = user.whatsapp_instance_id;
        } else {
          // create personal instance for this user
          instanceId = `user-${userId}-${Date.now()}`;
          await setUserWhatsappInstance(userId, instanceId);
        }
      } else if (user && user.whatsapp_instance_id) {
        // non-comercial_pro users with personal instance (rare) use it
        instanceId = user.whatsapp_instance_id;
      }
    }

    await initSession(instanceId);
    const status = await getSessionStatus(instanceId);

    if (status.connected) {
      return res.json({
        ok: true,
        connected: true,
        phone_number: status.phone_number,
        bot_name: status.bot_name,
        instance_id: instanceId
      });
    }

    const qrCode = await getQRFromService(instanceId);

    if (!qrCode) {
      return res.json({
        ok: true,
        connected: false,
        message: 'QR code being generated. Please wait...',
        qr_code: null,
        instance_id: instanceId
      });
    }

    res.json({
      ok: true,
      connected: false,
      qr_code: qrCode,
      instance_id: instanceId
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function sendMessage(req, res) {
  try {
    const { lead_id, message, phone } = req.body;

    if (!lead_id || !message || !phone) {
      return res.status(400).json({ error: 'lead_id, message, and phone are required' });
    }

    const lead = await getLeadById(Number(lead_id));
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Resolve instance to use: prefer sender's personal instance, then lead's assigned user's instance. Never fallback to global.
    const userId = req.session?.userId || null;
    let instanceId = null;
    const { getUserById } = require('../models/userModel');
    if (userId) {
      const user = await getUserById(userId);
      if (user && user.whatsapp_instance_id) {
        instanceId = user.whatsapp_instance_id;
      } else if (user && user.role === 'admin') {
        // Admins may use the global main-bot instance
        instanceId = INSTANCE_ID;
      }
    }

    // If sender has no personal instance and is not admin, try to use the lead's assigned user's instance
    if (!instanceId && lead.assigned_to) {
      try {
        const assignedUser = await getUserById(lead.assigned_to);
        if (assignedUser && assignedUser.whatsapp_instance_id) instanceId = assignedUser.whatsapp_instance_id;
      } catch (e) { /* ignore */ }
    }

    if (!instanceId) {
      return res.status(400).json({ error: 'Debes conectar tu WhatsApp.' });
    }

    const status = await getSessionStatus(instanceId);
    if (!status.connected) {
      return res.status(400).json({ error: 'Debes conectar tu WhatsApp (escanea el QR para conectar).' });
    }

    const interpolatedMessage = await interpolateTemplate(message, lead);

    let normalizedPhone;
    try {
      normalizedPhone = normalizePhoneForWhatsApp(phone || lead.phone, lead.phone_type);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid phone number: ' + e.message });
    }

    try {
      const sentRes = await sendWhatsAppMessage(instanceId, normalizedPhone, interpolatedMessage);
      // Try to extract external id if any
      let externalId = null;
      try { externalId = sentRes?.key?.id || sentRes?.id || null; } catch (e) { externalId = null; }

      const messageData = await createMessage({
        instanceId: instanceId,
        leadId: Number(lead_id),
        recipientPhone: normalizedPhone,
        messageText: interpolatedMessage,
        messageType: 'text',
        direction: 'outbound',
        externalMessageId: externalId
      });

      return res.json({ ok: true, message_id: messageData.id, status: 'sent', message: 'Message sent successfully' });
    } catch (e) {
      return res.status(400).json({ error: 'Failed to send WhatsApp message: ' + e.message });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function getLeadMessagesHandler(req, res) {
  try {
    const lead_id = Number(req.params.lead_id);
    const messages = await getLeadMessages(lead_id);
    res.json({ ok: true, messages });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function getTemplatesHandler(req, res) {
  try {
    const templates = await getTemplates();
    res.json({ ok: true, templates });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function createTemplateHandler(req, res) {
  try {
    const { name, content, variables } = req.body;
    const userId = req.session?.userId || null;

    if (!name || !content) {
      return res.status(400).json({ error: 'name and content are required' });
    }

    const template = await createTemplate({ name, content, variables, createdBy: userId });
    res.json({ ok: true, template });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function deleteTemplateHandler(req, res) {
  try {
    const id = Number(req.params.id);
    const affected = await deleteTemplate(id);
    res.json({ ok: true, affected });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function getWhatsappStatus(req, res) {
  try {
    const userId = req.session?.userId || null;
    if (userId) {
      const { getUserById } = require('../models/userModel');
      const user = await getUserById(userId);
      // For comercial_pro users, do not expose global/admin instance status
      if (user && user.role === 'comercial_pro') {
        if (user.whatsapp_instance_id) {
          const status = await getSessionStatus(user.whatsapp_instance_id);
          return res.json({ ok: true, connected: status.connected, phone_number: status.phone_number, bot_name: status.bot_name, instance_id: user.whatsapp_instance_id });
        }
        return res.json({ ok: true, connected: false, phone_number: null, bot_name: null, instance_id: null });
      }
    }

    const status = await getSessionStatus(INSTANCE_ID);

    res.json({
      ok: true,
      connected: status.connected,
      phone_number: status.phone_number,
      bot_name: status.bot_name,
      instance_id: INSTANCE_ID
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function disconnectWhatsapp(req, res) {
  try {
    const userId = req.session?.userId || null;
    let instanceId = INSTANCE_ID;
    if (userId) {
      const { getUserById } = require('../models/userModel');
      const user = await getUserById(userId);
      if (user && user.whatsapp_instance_id) instanceId = user.whatsapp_instance_id;
    }
    await disconnectSession(instanceId);
    res.json({ ok: true, message: 'WhatsApp session disconnected', instance_id: instanceId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function createUserInstance(req, res) {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    // Only comercial_pro users can create personal instances
    const { getUserById, setUserWhatsappInstance } = require('../models/userModel');
    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'comercial_pro') return res.status(403).json({ error: 'Not allowed' });

    // Create a unique instance id
    const instanceId = `user-${userId}-${Date.now()}`;

    // Persist to user
    await setUserWhatsappInstance(userId, instanceId);

    // Initialize session (this will generate QR asynchronously)
    await initSession(instanceId);

    // Return instance id; frontend will poll /whatsapp/qr to get QR
    res.json({ ok: true, instance_id: instanceId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function getWhatsappStatusForUser(req, res) {
  try {
    const userId = req.session?.userId || null;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { getUserById } = require('../models/userModel');
    const user = await getUserById(userId);

    // For comercial_pro, do not expose admin/global instance
    if (user && user.role === 'comercial_pro') {
      if (user.whatsapp_instance_id) {
        const status = await getSessionStatus(user.whatsapp_instance_id);
        return res.json({ ok: true, ...status, instance_id: user.whatsapp_instance_id });
      }
      return res.json({ ok: true, connected: false, phone_number: null, bot_name: null, instance_id: null });
    }

    // For other users, if they have personal instance use it, otherwise return global status
    let instanceId = INSTANCE_ID;
    if (user && user.whatsapp_instance_id) instanceId = user.whatsapp_instance_id;
    const status = await getSessionStatus(instanceId);
    res.json({ ok: true, ...status, instance_id: instanceId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function sendGroupMessage(req, res) {
  try {
    const { message, groupName } = req.body;

    if (!message || !groupName) {
      return res.status(400).json({ error: 'message and groupName are required' });
    }

    const { sendMessageToGroup, findGroupByName } = require('../services/schedulerService');
    const { getSessionStatus } = require('../services/whatsappService');

    const instanceId = process.env.WHATSAPP_INSTANCE_ID || 'main-bot';
    const status = await getSessionStatus(instanceId);

    if (!status.connected) {
      return res.status(400).json({ error: 'WhatsApp not connected. Scan the QR code first.' });
    }

    const groupJid = await findGroupByName(groupName);
    await sendMessageToGroup(groupJid, message);

    return res.json({ ok: true, message: 'Group message sent successfully', groupJid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function testDailyPreview(req, res) {
  try {
    const { sendDailyPreviewMessage } = require('../services/schedulerService');
    const result = await sendDailyPreviewMessage();

    if (result.ok) {
      return res.json({ ok: true, message: 'Test message sent successfully', leadsCount: result.leadsCount });
    } else {
      return res.status(400).json({ error: result.error });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = {
  getQRCode,
  sendMessage,
  getLeadMessagesHandler,
  getTemplatesHandler,
  createTemplateHandler,
  deleteTemplateHandler,
  getWhatsappStatus,
  disconnectWhatsapp,
  createUserInstance,
  getWhatsappStatusForUser,
  sendGroupMessage,
  testDailyPreview
};
