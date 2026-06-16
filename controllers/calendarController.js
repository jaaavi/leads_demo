const { listLeads, updateLead, getLeadById } = require('../models/leadModel');
const pool = require('../db/localdata');

async function getAssignedLeads(req, res) {
  try {
    const userId = req.session?.userId || null;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Return all leads assigned to the current user (no pagination for calendar)
    const data = await listLeads({ page: 1, pageSize: 10000, assigned_to: userId });
    const leads = (data && data.data) ? data.data : [];

    // Map to minimal payload for calendar
    const payload = leads.map(l => {
      let isoDate = null;
      if (l.preview_delivery_date) {
        const d = new Date(l.preview_delivery_date);
        if (!isNaN(d.getTime())) {
          isoDate = d.toISOString();
        }
      }
      return {
        id: l.id,
        full_name: l.full_name,
        phone: l.phone,
        preview_delivery_date: isoDate,
        reminder_subject: l.reminder_subject
      };
    });
    res.json({ ok: true, leads: payload });
  } catch (e) {
    if (e && (e.code === 'ER_BAD_FIELD_ERROR' || String(e.message || '').includes('Unknown column'))) {
      return res.status(400).json({ error: "Falta la columna 'preview_delivery_date' en la tabla leads. Ejecuta las migraciones: node scripts/migrate.js" });
    }
    res.status(500).json({ error: e.message });
  }
}

async function searchLeads(req, res) {
  try {
    const userId = req.session?.userId || null;
    const userRole = req.session?.userRole || 'admin';
    const query = req.query.q ? String(req.query.q).trim() : '';

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (query.length < 2) return res.json({ leads: [] });

    // Search leads by name or phone
    let sql = `SELECT id, full_name, phone FROM leads WHERE deleted_at IS NULL AND (full_name LIKE ? OR phone LIKE ?)`;
    const params = [`%${query}%`, `%${query}%`];

    // For non-admin users, only show their assigned leads
    if (userRole !== 'admin') {
      sql += ` AND assigned_to = ?`;
      params.push(userId);
    }

    sql += ` LIMIT 20`;

    const [rows] = await pool.execute(sql, params);
    res.json({ leads: rows || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function updatePreviewDeliveryDate(req, res) {
  try {
    const id = Number(req.params.id);
    const userId = req.session?.userId || null;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { preview_delivery_date, reminder_subject } = req.body || {};

    const updateData = {};

    // Handle date
    let dateValue = null;
    if (preview_delivery_date) {
      const d = new Date(preview_delivery_date);
      if (isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid date' });
      const pad = (n) => String(n).padStart(2, '0');
      const dt = d;
      dateValue = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
    }
    updateData.preview_delivery_date = dateValue;

    // Handle reminder subject
    if (reminder_subject) {
      updateData.reminder_subject = reminder_subject;
    }

    await updateLead(id, updateData, userId);
    const lead = await getLeadById(id);
    res.json({ ok: true, lead });
  } catch (e) {
    if (e && (e.code === 'ER_BAD_FIELD_ERROR' || String(e.message || '').includes('Unknown column'))) {
      return res.status(400).json({ error: "Falta la columna 'preview_delivery_date' en la tabla leads. Ejecuta las migraciones: node scripts/migrate.js" });
    }
    res.status(500).json({ error: e.message });
  }
}

module.exports = { getAssignedLeads, updatePreviewDeliveryDate, searchLeads };
