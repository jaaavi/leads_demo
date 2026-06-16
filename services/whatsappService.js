const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

const { updateSessionQR, updateSessionConnected } = require('../models/whatsappModel');

const sessions = new Map();
const qrCodes = new Map();
const reconnectAttempts = new Map();
let baileys = null;
const EventEmitter = require('events');
const events = new EventEmitter();
// set max listeners a bit higher to avoid warnings in dev
events.setMaxListeners(100);

// Load Baileys dynamically
async function loadBaileys() {
  if (baileys) return baileys;
  baileys = await import('@whiskeysockets/baileys');
  return baileys;
}

function getReconnectDelay(instanceId) {
  const attempts = reconnectAttempts.get(instanceId) || 0;
  // Exponential backoff: 5s, 10s, 20s, 40s, max 60s
  const delay = Math.min(5000 * Math.pow(2, attempts), 60000);
  reconnectAttempts.set(instanceId, attempts + 1);
  return delay;
}

function resetReconnectAttempts(instanceId) {
  reconnectAttempts.delete(instanceId);
}

async function initSession(instanceId) {
  if (sessions.has(instanceId)) {
    return sessions.get(instanceId);
  }

  const authDir = path.join(__dirname, '../bot_sessions', instanceId);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  try {
    const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = await loadBaileys();
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ['Chrome', 'Desktop', '117.0.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: true,
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 0,
      keepAliveIntervalMs: 30_000,
      emitOwnEvents: true,
      fireInitQueries: false,
      generateHighQualityLinkPreview: true,
      patchMessageBeforeSending: (msg) => {
        const requiresFakeMdIfNotLinkPreview = true;
        if (requiresFakeMdIfNotLinkPreview && !msg.contextInfo) {
          msg.contextInfo = { forwardingScore: 1, isForwarded: false };
        }
        return msg;
      },
    });

    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrImage = await QRCode.toDataURL(qr);
          qrCodes.set(instanceId, qrImage);
          await updateSessionQR(instanceId, qrImage);
          console.log(`QR Code generated for instance: ${instanceId}`);
        } catch (e) {
          console.error('Error generating QR:', e.message);
        }
      }

      if (connection === 'open') {
        console.log(`WhatsApp connected for instance: ${instanceId}`);
        const phoneNumber = socket.user?.id?.replace('@s.whatsapp.net', '') || 'unknown';
        await updateSessionConnected(instanceId, true, phoneNumber, `Bot-${instanceId}`);
        qrCodes.delete(instanceId);
        resetReconnectAttempts(instanceId);
      } else if (connection === 'close') {
        const disconnectCode = (lastDisconnect?.error)?.output?.statusCode;
        const errorMessage = (lastDisconnect?.error)?.message;

        console.log(`WhatsApp disconnected for instance: ${instanceId}, code: ${disconnectCode}, error: ${errorMessage}`);
        await updateSessionConnected(instanceId, false);

        // Explicit logout (401) or forbidden (403) - don't reconnect
        if (disconnectCode === 401 || disconnectCode === 403) {
          console.log(`WhatsApp logged out explicitly for instance: ${instanceId}`);
          sessions.delete(instanceId);
          resetReconnectAttempts(instanceId);
        } else {
          // For other errors, reconnect with exponential backoff
          const delay = getReconnectDelay(instanceId);
          console.log(`Reconnecting instance ${instanceId} in ${delay}ms (attempt ${reconnectAttempts.get(instanceId)})`);
          setTimeout(() => {
            sessions.delete(instanceId);
            initSession(instanceId).catch(err => console.error(`Failed to reconnect ${instanceId}:`, err.message));
          }, delay);
        }
      }
    });

    socket.ev.on('creds.update', saveCreds);

    // Handle incoming messages and persist them
    socket.ev.on('messages.upsert', async (m) => {
      try {
        const messages = m?.messages || [];
        const { createMessage } = require('../models/whatsappModel');
        const pool = require('../db/config');

        for (const msg of messages) {
          try {
            if (!msg || msg.key?.fromMe) continue; // ignore own messages

            // Get text from possible places
            let text = '';
            try {
              if (msg.message?.conversation) text = msg.message.conversation;
              else if (msg.message?.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text;
              else if (msg.message?.imageMessage?.caption) text = msg.message.imageMessage.caption;
              else if (msg.message?.videoMessage?.caption) text = msg.message.videoMessage.caption;
              else if (typeof msg.message === 'string') text = msg.message;
            } catch (e) { text = '' }

            // Normalize jid to phone
            const jid = msg.key?.remoteJid || msg.key?.participant || '';
            const phone = String(jid).replace(/@s\.whatsapp\.net|@c\.us|@g\.us/g, '').replace(/[^0-9]/g, '');
            if (!phone) continue;

            // Try to find matching lead (best-effort): exact normalized match, then match by last 8 digits
            let leadId = null;
            try {
              const digits = phone.replace(/^\+/, '');
              // 1) exact normalized match
              const [rowsExact] = await pool.execute(
                `SELECT id, phone FROM leads WHERE deleted_at IS NULL AND REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '-', '') = ? LIMIT 1`,
                [digits]
              );
              if (rowsExact && rowsExact.length) {
                leadId = rowsExact[0].id;
              } else {
                // 2) match by last 8 digits
                const last8 = digits.slice(-8);
                const [rowsLike] = await pool.execute(
                  `SELECT id, phone FROM leads WHERE deleted_at IS NULL AND REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '-', '') LIKE CONCAT('%', ?) LIMIT 1`,
                  [last8]
                );
                if (rowsLike && rowsLike.length) leadId = rowsLike[0].id;
              }
            } catch (e) {
              console.warn('Warning: lead lookup failed', e.message);
            }

            // Persist inbound message
            let savedMsg = null;
            try {
              const msgRes = await createMessage({ instanceId: instanceId, leadId: leadId, recipientPhone: phone, messageText: text || '[media]', messageType: 'text', direction: 'inbound' });
              savedMsg = msgRes;
            } catch (e) {
              console.warn('Warning: failed to persist inbound message', e.message);
            }

            console.log(`Inbound message from ${phone} saved (lead ${leadId || 'unknown'})`);

            // Emit realtime event for frontend clients
            try {
              events.emit('message.inbound', { leadId: leadId || null, phone, text: text || '[media]', message: savedMsg || null, instanceId });
            } catch (e) {
              console.warn('Warning: failed to emit inbound event', e.message);
            }
          } catch (inner) {
            console.warn('Error handling incoming message:', inner.message);
          }
        }
      } catch (err) {
        console.error('messages.upsert handler error:', err.message);
      }
    });

    // Handle connection errors (stream errors, timeouts, etc)
    socket.ev.on('connection.error', async (error) => {
      console.error(`Connection error for instance ${instanceId}:`, error.message);
      // Force a clean reconnect by removing the session
      sessions.delete(instanceId);
    });

    sessions.set(instanceId, socket);
    return socket;
  } catch (e) {
    console.error(`Error initializing session ${instanceId}:`, e.message);
    throw e;
  }
}

async function getQRCode(instanceId) {
  await initSession(instanceId);

  if (qrCodes.has(instanceId)) {
    return qrCodes.get(instanceId);
  }

  return null;
}

async function sendMessage(instanceId, phoneNumber, message) {
  const socket = sessions.get(instanceId);

  if (!socket) {
    throw new Error('WhatsApp session not initialized');
  }

  if (!socket.user) {
    throw new Error('WhatsApp not connected. Scan the QR code first.');
  }

  try {
    const jid = phoneNumber.replace(/\D/g, '') + '@s.whatsapp.net';
    const result = await socket.sendMessage(jid, { text: message });
    return result;
  } catch (e) {
    console.error('Error sending message:', e.message);
    throw e;
  }
}

async function getSessionStatus(instanceId) {
  const socket = sessions.get(instanceId);

  if (!socket) {
    return {
      connected: false,
      phone_number: null,
      bot_name: null,
    };
  }

  return {
    connected: !!socket.user,
    phone_number: socket.user?.id?.replace('@s.whatsapp.net', '') || null,
    bot_name: socket.user?.name || `Bot-${instanceId}`,
  };
}

async function disconnectSession(instanceId) {
  const socket = sessions.get(instanceId);

  if (socket) {
    try {
      await socket.logout();
    } catch (e) {
      console.warn(`Error logging out session ${instanceId}:`, e.message);
    }
    sessions.delete(instanceId);
    qrCodes.delete(instanceId);
  }

  resetReconnectAttempts(instanceId);
  await updateSessionConnected(instanceId, false);

  // Delete the session directory from bot_sessions
  const authDir = path.join(__dirname, '../bot_sessions', instanceId);
  if (fs.existsSync(authDir)) {
    try {
      fs.rmSync(authDir, { recursive: true, force: true });
      console.log(`Session directory deleted: ${authDir}`);
    } catch (e) {
      console.warn(`Error deleting session directory ${authDir}:`, e.message);
    }
  }
}

module.exports = {
  initSession,
  getQRCode,
  sendMessage,
  getSessionStatus,
  disconnectSession,
  sessions,
  qrCodes,
  events,
};
