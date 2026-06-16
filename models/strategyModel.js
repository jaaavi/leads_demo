const pool = require('../db/config');

async function createStrategiesTable() {
  try {
    const connection = await pool.getConnection();
    try {
      const sql = `
        CREATE TABLE IF NOT EXISTS strategies (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          description TEXT,
          is_active TINYINT DEFAULT 1,
          created_by INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_active (is_active)
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

async function createStrategyMessagesTable() {
  try {
    const connection = await pool.getConnection();
    try {
      const sql = `
        CREATE TABLE IF NOT EXISTS strategy_messages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          strategy_id INT NOT NULL,
          message_type VARCHAR(100) NOT NULL,
          content LONGTEXT NOT NULL,
          phase INT DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE,
          UNIQUE KEY unique_strategy_message (strategy_id, message_type),
          INDEX idx_phase (phase)
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

async function getStrategyById(id) {
  const [rows] = await pool.execute(
    'SELECT * FROM strategies WHERE id = ? LIMIT 1',
    [id]
  );
  return rows.length ? rows[0] : null;
}

async function getActiveStrategy() {
  const [rows] = await pool.execute(
    'SELECT * FROM strategies WHERE is_active = 1 LIMIT 1'
  );
  return rows.length ? rows[0] : null;
}

async function listStrategies(userId = null) {
  if (userId === null) {
    // Admin: return all global strategies
    const [rows] = await pool.execute(
      'SELECT * FROM strategies WHERE user_id IS NULL ORDER BY created_at DESC'
    );
    return rows;
  }

  // Comercial Pro: return user-specific and global strategies
  const [rows] = await pool.execute(
    'SELECT * FROM strategies WHERE user_id IS NULL OR user_id = ? ORDER BY user_id DESC, created_at DESC',
    [userId]
  );
  return rows;
}

async function createStrategy({ name, description, createdBy = null, userId = null }) {
  const [res] = await pool.execute(
    'INSERT INTO strategies (user_id, name, description, created_by) VALUES (?, ?, ?, ?)',
    [userId || null, name, description || null, createdBy || null]
  );
  return { id: res.insertId, name, description, userId };
}

async function updateStrategy(id, { name, description, isActive }) {
  const updates = [];
  const params = [];

  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description);
  }
  if (isActive !== undefined) {
    updates.push('is_active = ?');
    params.push(isActive ? 1 : 0);
  }

  if (updates.length === 0) return false;

  params.push(id);

  const [res] = await pool.execute(
    `UPDATE strategies SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  return res.affectedRows > 0;
}

async function deleteStrategy(id) {
  const [res] = await pool.execute(
    'DELETE FROM strategies WHERE id = ?',
    [id]
  );
  return res.affectedRows > 0;
}

async function setActiveStrategy(id) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute('UPDATE strategies SET is_active = 0');
    await conn.execute('UPDATE strategies SET is_active = 1 WHERE id = ?', [id]);

    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function setActiveStrategyForUser(id, userId = null) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (userId === null) {
      // Admin: set global strategy (where user_id IS NULL)
      await conn.execute('UPDATE strategies SET is_active = 0 WHERE user_id IS NULL');
    } else {
      // Comercial Pro: set user-specific strategy
      await conn.execute('UPDATE strategies SET is_active = 0 WHERE user_id = ?', [userId]);
    }

    await conn.execute('UPDATE strategies SET is_active = 1 WHERE id = ?', [id]);

    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getActiveStrategyForUser(userId) {
  if (userId === null) {
    // Admin: return the global active strategy
    return getActiveStrategy();
  }

  // Comercial Pro: try to get user-specific active strategy first
  const [rows] = await pool.execute(
    'SELECT * FROM strategies WHERE user_id = ? AND is_active = 1 LIMIT 1',
    [userId]
  );

  if (rows.length > 0) {
    return rows[0];
  }

  // Fall back to global active strategy if user doesn't have one
  return getActiveStrategy();
}

async function getStrategyMessages(strategyId) {
  const [rows] = await pool.execute(
    'SELECT * FROM strategy_messages WHERE strategy_id = ? ORDER BY phase, message_type',
    [strategyId]
  );
  return rows;
}

async function getStrategyMessage(strategyId, messageType) {
  const [rows] = await pool.execute(
    'SELECT * FROM strategy_messages WHERE strategy_id = ? AND message_type = ? LIMIT 1',
    [strategyId, messageType]
  );
  return rows.length ? rows[0] : null;
}

async function createStrategyMessage({ strategyId, messageType, content, phase = 1 }) {
  const [res] = await pool.execute(
    'INSERT INTO strategy_messages (strategy_id, message_type, content, phase) VALUES (?, ?, ?, ?)',
    [strategyId, messageType, content, phase]
  );
  return { id: res.insertId };
}

async function updateStrategyMessage(id, { content, phase }) {
  const updates = [];
  const params = [];

  if (content !== undefined) {
    updates.push('content = ?');
    params.push(content);
  }
  if (phase !== undefined) {
    updates.push('phase = ?');
    params.push(phase);
  }

  if (updates.length === 0) return false;

  params.push(id);

  const [res] = await pool.execute(
    `UPDATE strategy_messages SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  return res.affectedRows > 0;
}

async function deleteStrategyMessage(id) {
  const [res] = await pool.execute(
    'DELETE FROM strategy_messages WHERE id = ?',
    [id]
  );
  return res.affectedRows > 0;
}

async function deleteStrategyMessageByStrategyAndType(strategyId, messageType) {
  const [res] = await pool.execute(
    'DELETE FROM strategy_messages WHERE strategy_id = ? AND message_type = ?',
    [strategyId, messageType]
  );
  return res.affectedRows > 0;
}

module.exports = {
  createStrategiesTable,
  createStrategyMessagesTable,
  getStrategyById,
  getActiveStrategy,
  listStrategies,
  createStrategy,
  updateStrategy,
  deleteStrategy,
  setActiveStrategy,
  setActiveStrategyForUser,
  getActiveStrategyForUser,
  getStrategyMessages,
  getStrategyMessage,
  createStrategyMessage,
  updateStrategyMessage,
  deleteStrategyMessage,
  deleteStrategyMessageByStrategyAndType
};
