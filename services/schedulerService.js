const { listLeads, getLeadById } = require('../models/leadModel');
const { sendMessage: sendWhatsAppMessage, getSessionStatus } = require('./whatsappService');

const INSTANCE_ID = process.env.WHATSAPP_INSTANCE_ID || 'main-bot';
const GROUP_NAME = 'Maquinaciones';

let schedulerRunning = false;

// Get today's date in YYYY-MM-DD format
function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get leads with preview_delivery_date today
async function getLeadsForToday() {
  try {
    const today = getTodayDate();
    const data = await listLeads({ page: 1, pageSize: 10000 });
    const allLeads = (data && data.data) ? data.data : [];
    
    // Filter leads where preview_delivery_date starts with today's date
    const leadsForToday = allLeads.filter(lead => {
      if (!lead.preview_delivery_date) return false;
      const dateStr = String(lead.preview_delivery_date);
      return dateStr.startsWith(today);
    });

    return leadsForToday;
  } catch (e) {
    console.error('Error getting leads for today:', e.message);
    return [];
  }
}

// Format preview message
async function formatPreviewMessage(leads) {
  if (!leads || leads.length === 0) {
    return 'Hoy no hay previsualizaciones programadas.';
  }

  const leadsList = leads
    .map(l => `• ${l.full_name}${l.assigned_username ? ` (${l.assigned_username})` : ''}`)
    .join('\n');

  return `📅 *Previsualizaciones para hoy*\n\n${leadsList}\n\nTotal: ${leads.length} previsualización(es)`;
}

// Send message to group
async function sendMessageToGroup(groupJid, message) {
  const { sessions, initSession } = require('./whatsappService');
  let socket = sessions.get(INSTANCE_ID);

  if (!socket) {
    socket = await initSession(INSTANCE_ID);
  }

  if (!socket || !socket.user) {
    throw new Error('WhatsApp not connected. Scan the QR code first.');
  }

  try {
    const result = await socket.sendMessage(groupJid, { text: message });
    return result;
  } catch (e) {
    console.error('Error sending message to group:', e.message);
    throw e;
  }
}

// Find group by name and get its JID
async function findGroupByName(groupName) {
  const { sessions, initSession } = require('./whatsappService');
  let socket = sessions.get(INSTANCE_ID);

  if (!socket) {
    // try to init session if not present
    socket = await initSession(INSTANCE_ID);
  }

  if (!socket || !socket.user) {
    throw new Error('WhatsApp not connected');
  }

  try {
    // Baileys v7: use groupFetchAllParticipating to list groups
    const groups = await socket.groupFetchAllParticipating();
    const list = Object.values(groups || {});
    const groupChat = list.find(g => g && g.subject && g.subject.toLowerCase().includes(groupName.toLowerCase()));

    if (!groupChat) {
      throw new Error(`Group "${groupName}" not found`);
    }

    return groupChat.id; // JID (e.g., 12345-67890@g.us)
  } catch (e) {
    console.error('Error finding group:', e.message);
    throw e;
  }
}

// Send daily preview message
async function sendDailyPreviewMessage() {
  try {
    const status = await getSessionStatus(INSTANCE_ID);
    
    if (!status.connected) {
      console.log('WhatsApp not connected, skipping daily preview message');
      return { ok: false, error: 'WhatsApp not connected' };
    }

    const leads = await getLeadsForToday();
    const message = await formatPreviewMessage(leads);
    
    const groupJid = await findGroupByName(GROUP_NAME);
    const result = await sendMessageToGroup(groupJid, message);
    
    console.log(`Daily preview message sent to group "${GROUP_NAME}"`, result);
    return { ok: true, message, groupJid, leadsCount: leads.length };
  } catch (e) {
    console.error('Error sending daily preview message:', e.message);
    return { ok: false, error: e.message };
  }
}

// Initialize scheduler (runs every minute, checks if it's 10 AM)
function initScheduler() {
  if (schedulerRunning) {
    console.log('Scheduler already running');
    return;
  }

  schedulerRunning = true;
  let lastRun = null;

  const interval = setInterval(async () => {
    try {
      const now = new Date();
      const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      // Check if it's 10:00 AM (10:00-10:59) and we haven't run today yet
      if (now.getHours() === 10 && lastRun !== currentDate) {
        console.log(`[${now.toLocaleString()}] Running daily preview message scheduler...`);
        await sendDailyPreviewMessage();
        lastRun = currentDate;
      }
    } catch (e) {
      console.error('Scheduler error:', e.message);
    }
  }, 60000); // Check every minute

  console.log('Daily preview message scheduler initialized (runs at 10:00 AM)');
}

module.exports = {
  initScheduler,
  sendDailyPreviewMessage,
  getLeadsForToday,
  formatPreviewMessage,
  sendMessageToGroup,
  findGroupByName,
  getTodayDate
};
