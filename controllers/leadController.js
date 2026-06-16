const { getLeadById, listLeads, createLead, createLeadAndUpdatePlace, updateLead, deleteLead, generateLeadsFromPlaces, getLeadActions, addLeadAction, getLeadSources, getLeadContactMethods, getLeadCities, getLeadBarrios, getLeadPhoneTypes } = require('../models/leadModel');

async function getLead(req, res) {
  try {
    const id = Number(req.params.id);
    const lead = await getLeadById(id);
    if (!lead) return res.status(404).json({ error: 'No encontrado' });
    res.json(lead);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function getLeads(req, res) {
  try {
    const { page, pageSize, status, source, city, barrio, phone_type, q, assigned_to, pending_reply, has_web, funnel_phase, jobId } = req.query;
    const userRole = req.session?.userRole || 'admin';
    const userId = req.session?.userId;

    // If comercial or comercial_pro, only show their own leads
    let filterAssignedTo = assigned_to;
    if ((userRole === 'comercial' || userRole === 'comercial_pro') && userId) {
      filterAssignedTo = userId;
    }

    console.log('[getLeads] Filters:', { page, pageSize, status, source, city, barrio, phone_type, q, assigned_to: filterAssignedTo, pending_reply, has_web, funnel_phase, jobId });

    // Support special 'funnel' status to filter leads that have an associated funnel
    let funnel = false;
    let statusFilter = status;
    if (status === 'funnel') { funnel = true; statusFilter = undefined; }
    const data = await listLeads({ page: Number(page) || 1, pageSize: Number(pageSize) || 20, status: statusFilter, source, city, barrio, phone_type, q, assigned_to: filterAssignedTo, funnel, pendingReply: pending_reply, has_web, funnelPhase: funnel_phase, jobId: jobId ? Number(jobId) : null });
    console.log('[getLeads] Results:', { total: data?.total, returned: data?.data?.length });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function postLead(req, res) {
  try {
    const lead = await createLead(req.body || {});
    res.json({ ok: true, lead });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function putLead(req, res) {
  try {
    const id = Number(req.params.id);
    const userId = req.session?.userId || null;

    // No mapping: allow 'closed' and other valid status values to be saved directly.
    // Ensure status is a string and trim it to avoid accidental long values that would be truncated by the DB
    if (req.body && typeof req.body.status === 'string') {
      req.body.status = String(req.body.status).toLowerCase().trim();
      // Optionally validate against a whitelist of allowed statuses to avoid DB enum errors
      const allowed = ['new', 'contacted', 'interested', 'negotiation', 'qualified', 'converted', 'closed', 'discarded'];
      if (!allowed.includes(req.body.status)) {
        return res.status(400).json({ error: `Invalid status value: ${req.body.status}` });
      }
    }

    console.log(`PUT /leads/${id} payload:`, req.body);
    const result = await updateLead(id, req.body || {}, userId);
    console.log(`PUT /leads/${id} result:`, result);
    res.json({ ok: true, result });
  } catch (e) {
    console.error('Error in putLead:', e);
    res.status(500).json({ error: e.message });
  }
}

async function removeLead(req, res) {
  try {
    const id = Number(req.params.id);
    const result = await deleteLead(id);
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function generate(req, res) {
  try {
    const { requireHasPhone = '1', requireNoWeb = '0', category, city, limit } = req.body || {};
    const result = await generateLeadsFromPlaces({
      requireHasPhone: String(requireHasPhone) === '1',
      requireNoWeb: String(requireNoWeb) === '1',
      category: category || undefined,
      city: city || undefined,
      limit: Number(limit) || 100,
    });
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function getLeadMeta(req, res) {
  try {
    const userId = req.session?.userId || null;
    const userRole = req.session?.userRole || 'admin';

    const sources = await getLeadSources();
    const contactMethods = await getLeadContactMethods();
    let cities = await getLeadCities();
    let barrios = await getLeadBarrios();
    const phoneTypes = await getLeadPhoneTypes();

    // If no cities/barrios found on leads, fallback to places meta so filters populate
    if ((!cities || cities.length === 0) || (!barrios || barrios.length === 0)) {
      try {
        const { getMeta } = require('../models/placeModel');
        const placeMeta = await getMeta(userRole === 'comercial_pro' ? userId : null);
        if (!cities || cities.length === 0) cities = placeMeta.cities || [];
        if (!barrios || barrios.length === 0) barrios = placeMeta.barrios || [];
      } catch (innerErr) {
        // Ignore; keep existing empty arrays
        console.warn('Could not fallback to places meta for lead filters:', innerErr.message);
      }
    }

    // Get list of jobs
    let jobs = [];
    try {
      const jobModel = require('../models/jobModel');
      if (jobModel && jobModel.getJobs) {
        jobs = await jobModel.getJobs(userRole === 'comercial_pro' ? userId : null, userRole);
      }
    } catch (e) {
      console.warn('Error fetching jobs for meta:', e.message);
    }

    res.json({ sources, contactMethods, cities, barrios, phoneTypes, statuses: ['new', 'contacted', 'interested', 'negotiation', 'closed', 'discarded'], jobs: jobs || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function getLeadActionsHandler(req, res) {
  try {
    const lead_id = Number(req.params.lead_id);
    const actions = await getLeadActions(lead_id);
    res.json({ actions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function addLeadActionHandler(req, res) {
  try {
    const lead_id = Number(req.params.lead_id);
    const userId = req.session?.userId || null;
    const { action_type, action_description, old_value, new_value } = req.body || {};
    const result = await addLeadAction({ lead_id, user_id: userId, action_type, action_description, old_value, new_value });
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function bulkAssignLeads(req, res) {
  try {
    const { lead_ids, assigned_to } = req.body;
    const userId = req.session?.userId || null;

    if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({ error: 'lead_ids debe ser un array no vacío' });
    }

    if (!assigned_to && assigned_to !== 0) {
      return res.status(400).json({ error: 'assigned_to es requerido' });
    }

    const { updateLead } = require('../models/leadModel');
    const results = [];

    for (const lead_id of lead_ids) {
      const id = Number(lead_id);
      try {
        const result = await updateLead(id, { assigned_to: assigned_to || null }, userId);
        results.push({ lead_id: id, success: true });
      } catch (e) {
        results.push({ lead_id: id, success: false, error: e.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    res.json({ ok: true, results, assigned: successCount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function bulkDeleteLeads(req, res) {
  try {
    const { lead_ids } = req.body || {};
    if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({ error: 'lead_ids debe ser un array no vacío' });
    }
    const ids = lead_ids.map((x) => Number(x)).filter((x) => Number.isFinite(x));
    const { deleteLead } = require('../models/leadModel');

    let deleted = 0;
    for (const id of ids) {
      try {
        const resDel = await deleteLead(id);
        deleted += resDel?.affectedRows ? 1 : 0;
      } catch (e) {
        // Continue deleting others; optionally collect errors
      }
    }
    return res.json({ ok: true, deleted });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

async function sendLeadToPlaces(req, res) {
  try {
    const leadId = Number(req.params.id);
    const userId = req.session?.userId || null;

    // Get the lead
    const lead = await getLeadById(leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }

    // Import placeModel to create a place
    const { createPlace } = require('../models/placeModel');

    // Create a place from the lead
    const placeData = {
      name: lead.full_name,
      phone: lead.phone,
      phone_type: lead.phone_type,
      web: lead.web,
      city: lead.city,
      notes: lead.notes ? `Lead: ${lead.notes}` : `Lead creado desde ${lead.full_name}`,
      tags: lead.tags,
      user_id: userId
    };

    const placeId = await createPlace(placeData);

    // Add action log
    await addLeadAction({
      lead_id: leadId,
      user_id: userId,
      action_type: 'sent_to_places',
      action_description: `Lead enviado a places como lugar ID ${placeId}`
    });

    res.json({ ok: true, placeId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = { getLead, getLeads, postLead, putLead, removeLead, generate, getLeadMeta, getLeadActionsHandler, addLeadActionHandler, bulkAssignLeads, bulkDeleteLeads, sendLeadToPlaces };
