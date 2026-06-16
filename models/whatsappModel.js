const pool = require('../db/config');

async function createWhatsappSessionsTable() {
  try {
    const connection = await pool.getConnection();
    try {
      const sql = `
        CREATE TABLE IF NOT EXISTS whatsapp_sessions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          instance_id VARCHAR(255) UNIQUE NOT NULL,
          connected TINYINT DEFAULT 0,
          phone_number VARCHAR(50),
          bot_name VARCHAR(255),
          qr_code LONGTEXT,
          qr_code_updated_at TIMESTAMP,
          last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `;
      await connection.query(sql);
    } finally {
      connection.release();
    }
  } catch (err) {
    throw err;
  }
}

async function createWhatsappMessagesTable() {
  try {
    const connection = await pool.getConnection();
    try {
      const sql = `
        CREATE TABLE IF NOT EXISTS whatsapp_messages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          instance_id VARCHAR(255) NOT NULL,
          lead_id INT,
          recipient_phone VARCHAR(50),
          message_text LONGTEXT,
          message_type VARCHAR(50) DEFAULT 'text',
          direction VARCHAR(20) DEFAULT 'outbound',
          external_message_id VARCHAR(255),
          delivery_status VARCHAR(50) DEFAULT 'pending',
          sent_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (instance_id) REFERENCES whatsapp_sessions(instance_id) ON DELETE CASCADE,
          INDEX idx_instance (instance_id),
          INDEX idx_lead (lead_id),
          INDEX idx_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `;
      await connection.query(sql);

      // Ensure optional columns exist (for older schemas)
      try {
        await connection.query("ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS external_message_id VARCHAR(255)");
      } catch (e) {
        // ignore
      }
      try {
        await connection.query("ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(50) DEFAULT 'pending'");
      } catch (e) {
        // ignore
      }
      try {
        await connection.query("ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS direction VARCHAR(20) DEFAULT 'outbound'");
      } catch (e) {
        // ignore
      }
    } finally {
      connection.release();
    }
  } catch (err) {
    throw err;
  }
}

async function createMessageTemplatesTable() {
  try {
    const connection = await pool.getConnection();
    try {
      const sql = `
        CREATE TABLE IF NOT EXISTS message_templates (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          content LONGTEXT NOT NULL,
          variables JSON,
          created_by INT,
          is_active TINYINT DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `;
      await connection.query(sql);
    } finally {
      connection.release();
    }
  } catch (err) {
    throw err;
  }
}

async function getOrCreateSession(instanceId) {
  const [rows] = await pool.execute('SELECT * FROM whatsapp_sessions WHERE instance_id = ? LIMIT 1', [instanceId]);
  if (rows.length) {
    return rows[0];
  }
  const [res] = await pool.execute('INSERT INTO whatsapp_sessions (instance_id) VALUES (?)', [instanceId]);
  return { id: res.insertId, instance_id: instanceId, connected: 0, qr_code: null };
}

async function updateSessionQR(instanceId, qrCode) {
  await pool.execute('UPDATE whatsapp_sessions SET qr_code = ?, qr_code_updated_at = NOW() WHERE instance_id = ?', [qrCode, instanceId]);
}

async function updateSessionConnected(instanceId, connected, phoneNumber = null, botName = null) {
  await pool.execute('UPDATE whatsapp_sessions SET connected = ?, phone_number = ?, bot_name = ?, last_activity = NOW() WHERE instance_id = ?', [connected ? 1 : 0, phoneNumber, botName, instanceId]);
}

async function getSession(instanceId) {
  const [rows] = await pool.execute('SELECT * FROM whatsapp_sessions WHERE instance_id = ? LIMIT 1', [instanceId]);
  return rows.length ? rows[0] : null;
}

async function getAllSessions() {
  const [rows] = await pool.execute('SELECT * FROM whatsapp_sessions ORDER BY last_activity DESC');
  return rows;
}

async function createMessage({ instanceId, leadId = null, recipientPhone, messageText, messageType = 'text', direction = 'outbound', externalMessageId = null }) {
  const deliveryStatus = direction === 'outbound' ? 'pending' : 'received';

  // Try normal insert first. Some DB schemas may have lead_id NOT NULL causing insert errors when leadId is null.
  try {
    const [res] = await pool.execute(
      'INSERT INTO whatsapp_messages (instance_id, lead_id, recipient_phone, message_text, message_type, direction, external_message_id, delivery_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [instanceId, leadId || null, recipientPhone, messageText, messageType, direction, externalMessageId || null, deliveryStatus]
    );
    return { id: res.insertId };
  } catch (e) {
    // If insert failed because lead_id cannot be null, try inserting without lead_id column
    if (e && (e.code === 'ER_BAD_NULL_ERROR' || e.message && e.message.toLowerCase().includes('cannot be null') )) {
      try {
        const [res2] = await pool.execute(
          'INSERT INTO whatsapp_messages (instance_id, recipient_phone, message_text, message_type, direction, external_message_id, delivery_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [instanceId, recipientPhone, messageText, messageType, direction, externalMessageId || null, deliveryStatus]
        );
        return { id: res2.insertId };
      } catch (e2) {
        throw e2;
      }
    }

    throw e;
  }
}

async function getLeadMessages(leadId) {
  const [rows] = await pool.execute(
    'SELECT * FROM whatsapp_messages WHERE lead_id = ? ORDER BY created_at DESC LIMIT 50',
    [leadId]
  );
  return rows;
}

async function updateMessageStatus(messageId, status, sentAt = null) {
  const updates = ['delivery_status = ?'];
  const params = [status];
  
  if (sentAt) {
    updates.push('sent_at = ?');
    params.push(sentAt);
  }
  
  params.push(messageId);
  await pool.execute(`UPDATE whatsapp_messages SET ${updates.join(', ')} WHERE id = ?`, params);
}

async function getTemplates() {
  try {
    const [rows] = await pool.execute('SELECT * FROM message_templates WHERE is_active = 1 ORDER BY name');
    return rows;
  } catch (e) {
    // Table doesn't exist yet, return empty array
    if (e.code === 'ER_NO_SUCH_TABLE') {
      return [];
    }
    throw e;
  }
}

async function createTemplate({ name, content, variables = null, createdBy = null }) {
  try {
    const [res] = await pool.execute(
      'INSERT INTO message_templates (name, content, variables, created_by, is_active) VALUES (?, ?, ?, ?, 1)',
      [name, content, variables ? JSON.stringify(variables) : null, createdBy || null]
    );
    return { id: res.insertId };
  } catch (e) {
    // Table doesn't exist yet
    if (e.code === 'ER_NO_SUCH_TABLE') {
      throw new Error('Message templates table not created yet. Run the migration first.');
    }
    throw e;
  }
}

async function getTemplateById(id) {
  try {
    const [rows] = await pool.execute('SELECT * FROM message_templates WHERE id = ? LIMIT 1', [id]);
    return rows.length ? rows[0] : null;
  } catch (e) {
    // Table doesn't exist yet
    if (e.code === 'ER_NO_SUCH_TABLE') {
      return null;
    }
    throw e;
  }
}

async function deleteTemplate(id) {
  try {
    const [res] = await pool.execute('DELETE FROM message_templates WHERE id = ?', [id]);
    return res.affectedRows;
  } catch (e) {
    // Table doesn't exist yet
    if (e.code === 'ER_NO_SUCH_TABLE') {
      return 0;
    }
    throw e;
  }
}

async function interpolateTemplate(templateContent, leadData) {
  let message = templateContent;
  if (!leadData) return message;

  // Lead fields
  message = message.replace(/{nombre}/g, leadData.full_name || '');
  message = message.replace(/{phone}/g, leadData.phone || leadData.telefono || '');
  message = message.replace(/{email}/g, leadData.email || '');
  message = message.replace(/{city}/g, leadData.city || '');

  // Funnel/phase specific fields (allow either direct or inside funnel data object)
  const sector = leadData.sector || (leadData.data && leadData.data.sector) || '';
  const descripcion = leadData.descripcion || (leadData.data && leadData.data.descripcion) || '';
  const servicios = leadData.servicios || (leadData.data && leadData.data.servicios) || '';
  const estilo = leadData.estilo_web || leadData.referencias_visuales || (leadData.data && (leadData.data.estilo_web || leadData.data.referencias_visuales)) || '';
  const imagenes = leadData.fotos_representativas || (leadData.data && leadData.data.fotos_representativas) || '';
  const direccion = leadData.direccion || (leadData.data && leadData.data.direccion) || '';
  const telefono = leadData.telefono || leadData.phone || (leadData.data && leadData.data.telefofo_contacto) || '';

  message = message.replace(/{sector}/g, sector);
  message = message.replace(/{descripcion}/g, descripcion);
  message = message.replace(/{servicios}/g, servicios);
  message = message.replace(/{estilo}/g, estilo);
  message = message.replace(/{imagenes}/g, imagenes);
  message = message.replace(/{direccion}/g, direccion);
  message = message.replace(/{telefono}/g, telefono);

  return message;
}

module.exports = {
  createWhatsappSessionsTable,
  createWhatsappMessagesTable,
  createMessageTemplatesTable,
  getOrCreateSession,
  updateSessionQR,
  updateSessionConnected,
  getSession,
  getAllSessions,
  createMessage,
  getLeadMessages,
  updateMessageStatus,
  getTemplates,
  createTemplate,
  getTemplateById,
  deleteTemplate,
  interpolateTemplate,
};
