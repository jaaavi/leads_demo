const pool = require('../db/localdata');
const { shouldExcludePlace, EXCLUDED_CATEGORIES, EXCLUDED_DOMAINS } = require('../utils/excludedCategoriesAndDomains');

async function getLeadById(id) {
  const [rows] = await pool.execute(
    `SELECT l.*, u.username as assigned_username FROM leads l
     LEFT JOIN users u ON l.assigned_to = u.id
     WHERE l.id = ? AND l.deleted_at IS NULL LIMIT 1`,
    [id]
  );
  return rows.length ? rows[0] : null;
}

async function getLeadActions(lead_id) {
  const [rows] = await pool.execute(
    `SELECT la.*, u.username FROM lead_actions la
     LEFT JOIN users u ON la.user_id = u.id
     WHERE la.lead_id = ?
     ORDER BY la.created_at DESC`,
    [lead_id]
  );
  return rows;
}

async function addLeadAction({ lead_id, user_id = null, action_type, action_description, old_value = null, new_value = null }) {
  const [res] = await pool.execute(
    `INSERT INTO lead_actions (lead_id, user_id, action_type, action_description, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)`,
    [lead_id, user_id || null, action_type, action_description || null, old_value || null, new_value || null]
  );
  return { id: res.insertId };
}

async function getLeadSources() {
  const [rows] = await pool.execute(`SELECT DISTINCT source FROM leads WHERE source IS NOT NULL AND source <> '' AND deleted_at IS NULL ORDER BY source`);
  return rows.map(r => r.source);
}

async function getLeadContactMethods() {
  const [rows] = await pool.execute(`SELECT DISTINCT contact_method FROM leads WHERE contact_method IS NOT NULL AND contact_method <> '' AND deleted_at IS NULL ORDER BY contact_method`);
  return rows.map(r => r.contact_method);
}

async function getLeadCities() {
  // Try to combine cities from leads and places; if leads.city doesn't exist, fallback to places only
  try {
    const [rows] = await pool.execute(`
      SELECT DISTINCT city FROM (
        SELECT city FROM leads WHERE deleted_at IS NULL
        UNION
        SELECT city FROM places WHERE deleted_at IS NULL
      ) t WHERE city IS NOT NULL AND city <> '' ORDER BY city
    `);
    return rows.map(r => r.city);
  } catch (e) {
    // Likely leads.city column missing; fallback to places
    try {
      const [rows2] = await pool.execute(`SELECT DISTINCT city FROM places WHERE city IS NOT NULL AND city <> '' AND deleted_at IS NULL ORDER BY city`);
      return rows2.map(r => r.city);
    } catch (e2) {
      console.warn('Failed to load cities from leads or places:', e2.message);
      return [];
    }
  }
}

async function getLeadBarrios() {
  // Try to combine barrios from leads and places; if leads.barrio doesn't exist, fallback to places only
  try {
    const [rows] = await pool.execute(`
      SELECT DISTINCT barrio FROM (
        SELECT barrio FROM leads WHERE deleted_at IS NULL
        UNION
        SELECT barrio FROM places WHERE deleted_at IS NULL
      ) t WHERE barrio IS NOT NULL AND barrio <> '' ORDER BY barrio
    `);
    return rows.map(r => r.barrio);
  } catch (e) {
    // Likely leads.barrio column missing; fallback to places
    try {
      const [rows2] = await pool.execute(`SELECT DISTINCT barrio FROM places WHERE barrio IS NOT NULL AND barrio <> '' AND deleted_at IS NULL ORDER BY barrio`);
      return rows2.map(r => r.barrio);
    } catch (e2) {
      console.warn('Failed to load barrios from leads or places:', e2.message);
      return [];
    }
  }
}

async function getLeadPhoneTypes() {
  const [rows] = await pool.execute(`SELECT DISTINCT phone_type FROM leads WHERE phone_type IS NOT NULL AND phone_type <> '' AND deleted_at IS NULL ORDER BY phone_type`);
  return rows.map(r => r.phone_type);
}

async function listLeads({ page = 1, pageSize = 20, status, source, city, barrio, phone_type, q, assigned_to, funnel = false, pendingReply = null, has_web = null, funnelPhase = null, jobId = null }) {
  const offset = (page - 1) * pageSize;
  const where = [];
  const params = [];

  // Exclude soft-deleted leads
  where.push('l.deleted_at IS NULL');

  // Filters on leads table
  if (status) { where.push('l.status = ?'); params.push(status); }
  if (source) { where.push('l.source = ?'); params.push(source); }
  if (jobId !== null) {
    console.log('[listLeads] Attempting to filter by jobId:', jobId);
    try {
      const [colRows] = await pool.execute("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads' AND COLUMN_NAME = 'job_id' LIMIT 1");
      if (Array.isArray(colRows) && colRows.length > 0) {
        console.log('[listLeads] job_id column exists, applying filter');
        where.push('l.job_id = ?');
        params.push(jobId);
      } else {
        console.warn('[listLeads] job_id column does not exist in leads table');
      }
    } catch (e) {
      console.warn('[listLeads] Could not check job_id column in leads:', e.message);
    }
  }
  if (city) { where.push('l.city = ?'); params.push(city); }
  if (barrio) {
    // Conditionally filter by lead barrio if column exists; otherwise filter only by place barrio
    let hasBarrioColumn = false;
    try {
      const [colRows] = await pool.execute("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads' AND COLUMN_NAME = 'barrio' LIMIT 1");
      hasBarrioColumn = Array.isArray(colRows) && colRows.length > 0;
    } catch (e) {
      hasBarrioColumn = false;
    }

    if (hasBarrioColumn) {
      where.push('(l.barrio = ? OR p.barrio = ?)');
      params.push(barrio, barrio);
    } else {
      where.push('p.barrio = ?');
      params.push(barrio);
    }
  }
  if (phone_type && phone_type !== 'all') { where.push('l.phone_type = ?'); params.push(phone_type); }
  if (assigned_to === 'null') { where.push('l.assigned_to IS NULL'); }
  else if (assigned_to) { where.push('l.assigned_to = ?'); params.push(assigned_to); }
  if (has_web === '1') { where.push("(l.web IS NOT NULL AND l.web <> '')"); }
  else if (has_web === '0') { where.push("(l.web IS NULL OR l.web = '')"); }
  if (q) { where.push('(l.full_name LIKE ? OR l.email LIKE ? OR l.phone LIKE ? OR l.notes LIKE ? OR l.tags LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }

  // Exclude leads with excluded domains in their web field
  // Important: Include NULL check because NULL NOT LIKE returns NULL, not TRUE
  const excludedDomainsConditions = EXCLUDED_DOMAINS.map(() => `(l.web IS NULL OR l.web NOT LIKE ?)`);
  if (excludedDomainsConditions.length > 0) {
    where.push(`(${excludedDomainsConditions.join(' AND ')})`);
    params.push(...EXCLUDED_DOMAINS.map(domain => `%${domain}%`));
  }

  // If filtering by status 'new' (Pendiente), exclude those already in funnel
  const excludeFunnelOnPending = status === 'new';

  // If filtering by funnel presence or by funnelPhase, join against funnel phases
  const needFunnelJoin = funnel || (funnelPhase !== null && funnelPhase !== undefined && funnelPhase !== '');
  const funnelJoin = needFunnelJoin ? 'JOIN lead_funnel_phases lfp ON l.id = lfp.lead_id' : 'LEFT JOIN lead_funnel_phases lfp ON l.id = lfp.lead_id';

  // If filtering by a specific funnel phase, add condition
  if (needFunnelJoin && funnelPhase !== null && funnelPhase !== undefined && funnelPhase !== '') {
    where.push('lfp.current_phase = ?');
    params.push(Number(funnelPhase));
  }

  // Recompute base WHERE after possibly adding funnel phase condition
  // Build has_replied subquery: true if there's any inbound message for the lead
  const hasRepliedSubquery = `(SELECT COUNT(*) > 0 FROM whatsapp_messages wm WHERE wm.lead_id = l.id AND wm.direction = 'inbound')`;

  // Compose final WHERE combining the generic 'where' array plus pendingReply and excludeFunnelOnPending
  const extraWhere = [];
  if (pendingReply && (pendingReply === '1' || pendingReply === 1 || pendingReply === true)) {
    extraWhere.push(hasRepliedSubquery);
  }
  if (excludeFunnelOnPending) {
    extraWhere.push('lfp.current_phase IS NULL');
  }

  const allWhere = where.concat(extraWhere);
  const whereSql = allWhere.length ? `WHERE ${allWhere.join(' AND ')}` : '';

  console.log('[listLeads] Final WHERE clause:', whereSql);
  console.log('[listLeads] Filter object:', { status, source, city, barrio, phone_type, q, assigned_to, funnel, pendingReply, has_web, funnelPhase, jobId });

  // Priority ordering: 0=pending (not in funnel), 1=in funnel (not closed/discarded), 2=rest
  const orderPriority = `CASE
    WHEN l.status IN ('new','contacted','interested','negotiation') AND (lfp.current_phase IS NULL) THEN 0
    WHEN (lfp.current_phase IS NOT NULL) AND l.status NOT IN ('closed','discarded') THEN 1
    ELSE 2
  END`;

  // Join places to surface barrio/city stored on places when leads don't have them
  const placeJoin = 'LEFT JOIN places p ON p.lead_id = l.id';

  // Check if places.barrio exists before including in select
  let includePlaceBarrio = false;
  try {
    const [colRows] = await pool.execute("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'places' AND COLUMN_NAME = 'barrio' LIMIT 1");
    includePlaceBarrio = Array.isArray(colRows) && colRows.length > 0;
  } catch (e) {
    includePlaceBarrio = false;
  }

  const placeSelect = includePlaceBarrio ? 'p.city as place_city, p.barrio as place_barrio,' : 'p.city as place_city,';

  const [rows] = await pool.execute(
    `SELECT l.*, u.username as assigned_username, lfp.current_phase as funnel_phase, ${placeSelect}
      ${hasRepliedSubquery} AS has_replied
     FROM leads l
     LEFT JOIN users u ON l.assigned_to = u.id
     ${placeJoin}
     ${funnelJoin}
    ${whereSql}
    ORDER BY ${orderPriority} ASC, l.created_at DESC LIMIT ? OFFSET ?`,
   [...params, Number(pageSize), Number(offset)]
  );

  // Count needs to account for filters, place join and funnel join
  const countQuery = `SELECT COUNT(*) as cnt FROM leads l LEFT JOIN places p ON p.lead_id = l.id ${funnelJoin} ${whereSql}`;
  const [countRows] = await pool.execute(countQuery, params);

  return { data: rows, total: countRows[0].cnt, page: Number(page), pageSize: Number(pageSize) };
}

async function createLead({ user_id = null, full_name, email = null, phone = null, city = null, phone_type = null, source = 'scraper', status = 'new', notes = null, assigned_to = null, estimated_value = 0, estimated_benefit = 0, contact_method = null, tags = null, web = null }) {
  const [res] = await pool.execute(
    `INSERT INTO leads (user_id, full_name, email, phone, city, phone_type, source, status, notes, assigned_to, estimated_value, estimated_benefit, contact_method, tags, web) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [user_id, full_name || null, email || null, phone || null, city || null, phone_type || null, source, status, notes || null, assigned_to || null, estimated_value || 0, estimated_benefit || 0, contact_method || null, tags || null, web || null]
  );
  return { id: res.insertId };
}

async function createLeadAndUpdatePlace({ place_id, user_id = null, full_name, email = null, phone = null, city = null, phone_type = null, source = 'scraper', status = 'new', notes = null, assigned_to = null, estimated_value = 0, estimated_benefit = 0, contact_method = null, tags = null, web = null }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Fetch place data to fill in missing lead fields (only non-deleted)
    const [placeRows] = await conn.execute('SELECT * FROM places WHERE id = ? AND deleted_at IS NULL LIMIT 1', [place_id]);
    const place = placeRows.length ? placeRows[0] : null;

    // Use place data as fallback if not provided
    const leadCity = city || (place?.city || null);
    const leadPhoneType = phone_type || (place?.phone_type || null);
    const leadPhone = phone || (place?.phone || null);
    const leadFullName = full_name || (place?.name || null);
    let leadTags = tags || (place?.tags || null);
    let leadWeb = web || (place?.web || null);
    let leadNotes = notes;

    // Build notes from place data if not provided
    if (!leadNotes && place) {
      const noteDetails = [];
      if (place.main_category) noteDetails.push(`Categoría: ${place.main_category}`);
      if (place.street_address || place.city || place.zip) {
        const address = [place.street_address, place.city, place.zip].filter(Boolean).join(', ');
        if (address) noteDetails.push(`Dirección: ${address}`);
      }
      if (place.web) noteDetails.push(`Web: ${place.web}`);
      if (place.source_query) noteDetails.push(`Búsqueda: ${place.source_query}`);
      leadNotes = noteDetails.length ? noteDetails.join(' | ') : null;
    }

    const [res] = await conn.execute(
      `INSERT INTO leads (user_id, full_name, email, phone, city, phone_type, source, status, notes, assigned_to, estimated_value, estimated_benefit, contact_method, tags, web) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, leadFullName || null, email || null, leadPhone || null, leadCity || null, leadPhoneType || null, source, status, leadNotes || null, assigned_to || null, estimated_value || 0, estimated_benefit || 0, contact_method || null, leadTags || null, leadWeb || null]
    );
    const lead_id = res.insertId;

    // Update place with lead_id
    await conn.execute('UPDATE places SET lead_id = ? WHERE id = ?', [lead_id, place_id]);

    // Log action
    await conn.execute(
      `INSERT INTO lead_actions (lead_id, user_id, action_type, action_description) VALUES (?, ?, ?, ?)`,
      [lead_id, user_id || null, 'created', `Lead creado desde place ${place_id}`]
    );

    await conn.commit();
    return { id: lead_id };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function updateLead(id, fields, user_id = null) {
  const allowed = ['user_id', 'full_name', 'email', 'phone', 'city', 'phone_type', 'source', 'status', 'notes', 'assigned_to', 'estimated_value', 'estimated_benefit', 'contact_method', 'tags', 'preview_delivery_date', 'last_contact_date', 'web'];
  const sets = [];
  const params = [];
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Get current lead data for history
    const [currentLead] = await conn.execute('SELECT * FROM leads WHERE id = ?', [id]);
    const oldData = currentLead.length ? currentLead[0] : {};

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        sets.push(`${key} = ?`);
        params.push(fields[key]);

        // Log action for important field changes
        if (['status', 'assigned_to', 'estimated_value', 'contact_method', 'preview_delivery_date'].includes(key)) {
          const oldValue = oldData[key];
          const newValue = fields[key];
          if (oldValue !== newValue) {
            await conn.execute(
              `INSERT INTO lead_actions (lead_id, user_id, action_type, action_description, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)`,
              [id, user_id || null, `updated_${key}`, `${key} actualizado`, String(oldValue || ''), String(newValue || '')]
            );
          }
        }
      }
    }

    if (sets.length) {
      params.push(id);
      await conn.execute(`UPDATE leads SET ${sets.join(', ')} WHERE id = ?`, params);
    }

    await conn.commit();
    return { affectedRows: sets.length > 0 ? 1 : 0 };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function deleteLead(id) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('UPDATE places SET lead_id = NULL WHERE lead_id = ?', [id]);
    const [res] = await conn.execute('UPDATE leads SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [id]);
    await conn.commit();
    return { affectedRows: res.affectedRows };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function generateLeadsFromPlaces({ requireHasPhone = true, requireNoWeb = false, category, city, limit = 100 }) {
  const where = [];
  const params = [];
  where.push('p.deleted_at IS NULL');
  if (requireHasPhone) where.push('p.phone IS NOT NULL AND p.phone <> ""');
  if (requireNoWeb) where.push('(p.web IS NULL OR p.web = "")');
  if (category) { where.push('p.main_category = ?'); params.push(category); }
  if (city) { where.push('p.city = ?'); params.push(city); }

  // Exclude places with excluded categories
  const excludedCategoriesConditions = EXCLUDED_CATEGORIES.map(cat => `p.main_category NOT LIKE ?`);
  if (excludedCategoriesConditions.length > 0) {
    where.push(`(${excludedCategoriesConditions.join(' AND ')})`);
    params.push(...EXCLUDED_CATEGORIES.map(cat => `%${cat}%`));
  }

  // Exclude places with excluded domains
  const excludedDomainsConditions = EXCLUDED_DOMAINS.map(() => `p.web NOT LIKE ?`);
  if (excludedDomainsConditions.length > 0) {
    where.push(`(${excludedDomainsConditions.join(' AND ')})`);
    params.push(...EXCLUDED_DOMAINS.map(domain => `%${domain}%`));
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [places] = await pool.execute(
    `SELECT p.* FROM places p ${whereSql} ORDER BY p.created_at DESC LIMIT ?`,
    [...params, Number(limit)]
  );

  let created = 0;
  for (const p of places) {
    const [exists] = await pool.execute('SELECT id FROM leads WHERE deleted_at IS NULL AND ((phone = ? AND phone IS NOT NULL) OR (email = ? AND email IS NOT NULL)) LIMIT 1', [p.phone || null, null]);
    if (exists.length) continue;

    const noteDetails = [];
    if (p.main_category) noteDetails.push(`Categoría: ${p.main_category}`);
    if (p.street_address || p.city || p.zip) {
      const address = [p.street_address, p.city, p.zip].filter(Boolean).join(', ');
      if (address) noteDetails.push(`Dirección: ${address}`);
    }
    if (p.web) noteDetails.push(`Web: ${p.web}`);
    if (p.source_query) noteDetails.push(`Búsqueda: ${p.source_query}`);
    const notes = noteDetails.length ? noteDetails.join(' | ') : `Desde place ${p.place_id || p.id}`;

    await createLead({
      full_name: p.name,
      email: null,
      phone: p.phone,
      city: p.city || null,
      phone_type: p.phone_type || null,
      tags: p.tags || null,
      source: 'scraper',
      status: 'new',
      notes: notes
    });
    created += 1;
  }
  return { created };
}

async function syncLeadWithPlace(leadId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Find the place associated with this lead
    const [leadRows] = await conn.execute('SELECT * FROM leads WHERE id = ? LIMIT 1', [leadId]);
    if (!leadRows.length) throw new Error('Lead not found');

    const lead = leadRows[0];
    const [placeRows] = await conn.execute('SELECT * FROM places WHERE lead_id = ? AND deleted_at IS NULL LIMIT 1', [leadId]);

    if (!placeRows.length) {
      await conn.commit();
      return { synced: false, reason: 'No associated place found or place is deleted' };
    }

    const place = placeRows[0];
    const updates = [];
    const params = [];

    // Sync city if not set in lead
    if (!lead.city && place.city) {
      updates.push('city = ?');
      params.push(place.city);
    }

    // Sync phone_type if not set in lead
    if (!lead.phone_type && place.phone_type) {
      updates.push('phone_type = ?');
      params.push(place.phone_type);
    }

    // Merge tags if place has them
    if (place.tags && !lead.tags) {
      updates.push('tags = ?');
      params.push(place.tags);
    } else if (place.tags && lead.tags && !lead.tags.includes(place.tags)) {
      updates.push('tags = ?');
      params.push(`${lead.tags}, ${place.tags}`);
    }

    // Enhance notes with place data if needed
    const noteDetails = [];
    if (place.main_category) noteDetails.push(`Categoría: ${place.main_category}`);
    if (place.street_address || place.city || place.zip) {
      const address = [place.street_address, place.city, place.zip].filter(Boolean).join(', ');
      if (address) noteDetails.push(`Dirección: ${address}`);
    }
    if (place.web) noteDetails.push(`Web: ${place.web}`);

    if (noteDetails.length) {
      const newNotes = noteDetails.join(' | ');
      if (!lead.notes || !lead.notes.includes(newNotes)) {
        updates.push('notes = ?');
        params.push(lead.notes ? `${lead.notes}\n${newNotes}` : newNotes);
      }
    }

    if (updates.length) {
      params.push(leadId);
      await conn.execute(`UPDATE leads SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    await conn.commit();
    return { synced: updates.length > 0, fieldsUpdated: updates.length };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = {
  getLeadById,
  listLeads,
  createLead,
  createLeadAndUpdatePlace,
  updateLead,
  deleteLead,
  generateLeadsFromPlaces,
  syncLeadWithPlace,
  getLeadActions,
  addLeadAction,
  getLeadSources,
  getLeadContactMethods,
  getLeadCities,
  getLeadBarrios,
  getLeadPhoneTypes,
};
