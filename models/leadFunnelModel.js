const pool = require('../db/config');

// Initialize funnel for a lead
async function initializeFunnel(leadId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Check if already initialized
    const [existing] = await conn.execute(
      'SELECT id FROM lead_funnel_phases WHERE lead_id = ?',
      [leadId]
    );

    if (existing.length > 0) {
      await conn.commit();
      return existing[0];
    }

    // Create funnel phase record
    const [phaseRes] = await conn.execute(
      'INSERT INTO lead_funnel_phases (lead_id, current_phase) VALUES (?, 1)',
      [leadId]
    );

    // Create empty funnel data record
    await conn.execute(
      'INSERT INTO lead_funnel_data (lead_id) VALUES (?)',
      [leadId]
    );

    await conn.commit();
    return { id: phaseRes.insertId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Get funnel status for a lead
async function getFunnelStatus(leadId) {
  const [phases] = await pool.execute(
    'SELECT * FROM lead_funnel_phases WHERE lead_id = ?',
    [leadId]
  );

  if (!phases.length) {
    return null;
  }

  const [data] = await pool.execute(
    'SELECT * FROM lead_funnel_data WHERE lead_id = ?',
    [leadId]
  );

  const [prompts] = await pool.execute(
    'SELECT * FROM lead_funnel_prompts WHERE lead_id = ? ORDER BY created_at DESC LIMIT 1',
    [leadId]
  );

  return {
    phase: phases[0],
    data: data.length ? data[0] : null,
    lastPrompt: prompts.length ? prompts[0] : null,
  };
}

// Update opening message for phase 1
async function updateOpeningMessage(leadId, messageType, messageSent = false) {
  const [res] = await pool.execute(
    'UPDATE lead_funnel_phases SET opening_message_type = ?, opening_message_sent = ?, opening_message_sent_at = ? WHERE lead_id = ?',
    [messageType, messageSent ? 1 : 0, messageSent ? new Date() : null, leadId]
  );
  return res.affectedRows;
}

// Update phase 2 data (Recopilacion)
async function updatePhase2Data(leadId, data) {
  const {
    sector,
    descripcion,
    servicios,
    redes_sociales,
    fotos_representativas,
    estilo_web,
    referencias_visuales,
    direccion,
    telefofo_contacto,
  } = data;

  const [res] = await pool.execute(
    `UPDATE lead_funnel_data SET 
      sector = ?, 
      descripcion = ?, 
      servicios = ?, 
      redes_sociales = ?, 
      fotos_representativas = ?, 
      estilo_web = ?, 
      referencias_visuales = ?, 
      direccion = ?, 
      telefofo_contacto = ? 
    WHERE lead_id = ?`,
    [
      sector || null,
      descripcion || null,
      servicios || null,
      redes_sociales || null,
      fotos_representativas || null,
      estilo_web || null,
      referencias_visuales || null,
      direccion || null,
      telefofo_contacto || null,
      leadId,
    ]
  );

  // Mark phase 2 as completed
  await pool.execute(
    'UPDATE lead_funnel_phases SET current_phase = 3, phase_2_completed = 1, phase_2_completed_at = NOW() WHERE lead_id = ?',
    [leadId]
  );

  return res.affectedRows;
}

// Create phase 3 prompt
async function createPhase3Prompt(leadId, promptContent, userId = null) {
  const [res] = await pool.execute(
    'INSERT INTO lead_funnel_prompts (lead_id, prompt_content, created_by) VALUES (?, ?, ?)',
    [leadId, promptContent, userId || null]
  );

  // Mark phase 3 as completed
  await pool.execute(
    'UPDATE lead_funnel_phases SET phase_3_prompt_generated = 1, phase_3_prompt_generated_at = NOW() WHERE lead_id = ?',
    [leadId]
  );

  return { id: res.insertId };
}

// Update phase 4 preview URL
async function updatePhase4Preview(leadId, previewUrl) {
  const [res] = await pool.execute(
    'UPDATE lead_funnel_phases SET phase_4_preview_url = ?, current_phase = 4 WHERE lead_id = ?',
    [previewUrl, leadId]
  );
  return res.affectedRows;
}

// Mark phase 4 message as sent
async function markPhase4MessageSent(leadId) {
  const [res] = await pool.execute(
    'UPDATE lead_funnel_phases SET phase_4_message_sent = 1, phase_4_sent_at = NOW() WHERE lead_id = ?',
    [leadId]
  );
  return res.affectedRows;
}

// Set arbitrary phase flag (opening_message_sent, phase_2_completed, phase_3_prompt_generated, phase_4_message_sent)
async function setPhaseFlag(leadId, flagName, value) {
  const allowed = ['opening_message_sent', 'phase_2_completed', 'phase_3_prompt_generated', 'phase_4_message_sent'];
  if (!allowed.includes(flagName)) throw new Error('Invalid phase flag');

  const val = value ? 1 : 0;
  const timestampField = {
    opening_message_sent: 'opening_message_sent_at',
    phase_2_completed: 'phase_2_completed_at',
    phase_3_prompt_generated: 'phase_3_prompt_generated_at',
    phase_4_message_sent: 'phase_4_sent_at'
  }[flagName] || null;

  let sql;
  let params = [];
  if (timestampField && value) {
    sql = `UPDATE lead_funnel_phases SET ${flagName} = ?, ${timestampField} = NOW() WHERE lead_id = ?`;
    params = [val, leadId];
  } else if (timestampField && !value) {
    // Clearing the flag removes timestamp
    sql = `UPDATE lead_funnel_phases SET ${flagName} = ?, ${timestampField} = NULL WHERE lead_id = ?`;
    params = [val, leadId];
  } else {
    sql = `UPDATE lead_funnel_phases SET ${flagName} = ? WHERE lead_id = ?`;
    params = [val, leadId];
  }

  const [res] = await pool.execute(sql, params);

  // Recompute current_phase: first incomplete phase (1-4). If all complete, keep 4
  const [rows] = await pool.execute('SELECT opening_message_sent, phase_2_completed, phase_3_prompt_generated, phase_4_message_sent FROM lead_funnel_phases WHERE lead_id = ?', [leadId]);
  if (!rows.length) return res.affectedRows;
  const p = rows[0];
  let current_phase = 1;
  if (!p.opening_message_sent) current_phase = 1;
  else if (!p.phase_2_completed) current_phase = 2;
  else if (!p.phase_3_prompt_generated) current_phase = 3;
  else current_phase = 4;

  await pool.execute('UPDATE lead_funnel_phases SET current_phase = ? WHERE lead_id = ?', [current_phase, leadId]);

  return res.affectedRows;
}

// Get all leads with funnel status
async function getLeadsWithFunnelStatus() {
  const [rows] = await pool.execute(`
    SELECT
      l.id,
      l.full_name,
      l.phone,
      l.email,
      lfp.current_phase,
      lfp.opening_message_type,
      lfp.phase_2_completed,
      lfp.phase_3_prompt_generated,
      lfp.phase_4_preview_url,
      lfp.updated_at as funnel_updated_at
    FROM leads l
    LEFT JOIN lead_funnel_phases lfp ON l.id = lfp.lead_id
    WHERE l.deleted_at IS NULL
    ORDER BY l.created_at DESC
  `);
  return rows;
}

module.exports = {
  initializeFunnel,
  getFunnelStatus,
  updateOpeningMessage,
  updatePhase2Data,
  createPhase3Prompt,
  updatePhase4Preview,
  markPhase4MessageSent,
  getLeadsWithFunnelStatus,
  setPhaseFlag,
};
