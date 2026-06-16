const pool = require('../db/config');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

async function createUsersTable() {
  try {
    const connection = await pool.getConnection();
    try {
      const sql = `
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'admin',
          accessible_views JSON DEFAULT NULL,
          whatsapp_instance_id VARCHAR(100) DEFAULT NULL,
          whatsapp_config JSON DEFAULT NULL,
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

async function getUserByUsername(username) {
  try {
    const connection = await pool.getConnection();
    try {
      const sql = 'SELECT * FROM users WHERE username = ?';
      const [results] = await connection.query(sql, [username]);
      return results[0] || null;
    } finally {
      connection.release();
    }
  } catch (err) {
    throw err;
  }
}

async function getUserById(id) {
  try {
    const connection = await pool.getConnection();
    try {
      const sql = 'SELECT id, username, email, role, accessible_views, whatsapp_instance_id, whatsapp_config, created_at FROM users WHERE id = ?';
      const [results] = await connection.query(sql, [id]);
      return results[0] || null;
    } finally {
      connection.release();
    }
  } catch (err) {
    throw err;
  }
}

async function createUser(username, email, password, role = 'admin') {
  if (!username || !email || !password) {
    throw new Error('Username, email, and password are required');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid email format');
  }

  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters long');
  }

  if (!['admin', 'comercial', 'comercial_pro'].includes(role)) {
    throw new Error('Role must be either admin, comercial or comercial_pro');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    const connection = await pool.getConnection();
    try {
      const sql = 'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)';
      const [result] = await connection.query(sql, [username, email, passwordHash, role]);
      return { id: result.insertId, username, email, role };
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        throw new Error('Username or email already exists');
      }
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    throw err;
  }
}

async function updateUserRole(userId, newRole) {
  if (!['admin', 'comercial', 'comercial_pro'].includes(newRole)) {
    throw new Error('Role must be either admin, comercial or comercial_pro');
  }

  try {
    const connection = await pool.getConnection();
    try {
      const sql = 'UPDATE users SET role = ? WHERE id = ?';
      await connection.query(sql, [newRole, userId]);
      return true;
    } finally {
      connection.release();
    }
  } catch (err) {
    throw err;
  }
}

async function setUserViewPermissions(userId, viewNames) {
  try {
    const connection = await pool.getConnection();
    try {
      const sql = 'UPDATE users SET accessible_views = ? WHERE id = ?';
      const views = Array.isArray(viewNames) ? viewNames : [];
      await connection.query(sql, [JSON.stringify(views), userId]);
      return true;
    } finally {
      connection.release();
    }
  } catch (err) {
    throw err;
  }
}

async function getAllUsers() {
  try {
    const connection = await pool.getConnection();
    try {
      const sql = 'SELECT id, username, email, role, accessible_views, whatsapp_instance_id, created_at FROM users ORDER BY created_at DESC';
      const [results] = await connection.query(sql);
      return results;
    } finally {
      connection.release();
    }
  } catch (err) {
    throw err;
  }
}

async function deleteUser(userId) {
  try {
    const connection = await pool.getConnection();
    try {
      const sql = 'DELETE FROM users WHERE id = ?';
      const [result] = await connection.query(sql, [userId]);
      if (result.affectedRows === 0) {
        throw new Error('User not found');
      }
      return true;
    } finally {
      connection.release();
    }
  } catch (err) {
    throw err;
  }
}

async function setUserWhatsappInstance(userId, instanceId, config = null) {
  try {
    const connection = await pool.getConnection();
    try {
      const sql = 'UPDATE users SET whatsapp_instance_id = ?, whatsapp_config = ? WHERE id = ?';
      await connection.query(sql, [instanceId || null, config ? JSON.stringify(config) : null, userId]);
      return true;
    } finally {
      connection.release();
    }
  } catch (err) {
    throw err;
  }
}

async function setUserPassword(userId, newPassword) {
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    throw new Error('Password must be a string with at least 6 characters');
  }
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  try {
    const connection = await pool.getConnection();
    try {
      const sql = 'UPDATE users SET password_hash = ? WHERE id = ?';
      const [res] = await connection.query(sql, [passwordHash, userId]);
      if (res.affectedRows === 0) throw new Error('User not found');
      return true;
    } finally {
      connection.release();
    }
  } catch (err) {
    throw err;
  }
}

async function verifyPassword(user, password) {
  return bcrypt.compare(password, user.password_hash);
}

module.exports = {
  createUsersTable,
  getUserByUsername,
  getUserById,
  createUser,
  updateUserRole,
  setUserViewPermissions,
  getAllUsers,
  deleteUser,
  setUserWhatsappInstance,
  setUserPassword,
  verifyPassword,
};
