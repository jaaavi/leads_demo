const pool = require('../db/localdata');
const { getAllUsers, createUser, updateUserRole, getUserById, deleteUser, setUserPassword } = require('../models/userModel');

async function getUsers(req, res) {
  try {
    const [rows] = await pool.execute('SELECT id, username FROM users ORDER BY username');
    res.json({ data: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function getAdminPanel(req, res) {
  try {
    const users = await getAllUsers();
    res.render('admin/users', { users, session: req.session });
  } catch (error) {
    console.error('Error fetching users for admin panel:', error);
    res.status(500).send('Error loading user management panel');
  }
}

async function getAdminUsersJSON(req, res) {
  try {
    const users = await getAllUsers();
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function createUserAdmin(req, res) {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, error: 'Username, email, and password are required' });
    }

    const user = await createUser(username, email, password, role || 'comercial');
    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(400).json({ success: false, error: error.message });
  }
}

async function updateUserRoleAdmin(req, res) {
  try {
    const { userId, role } = req.body;

    if (!userId || !role) {
      return res.status(400).json({ success: false, error: 'User ID and role are required' });
    }

    await updateUserRole(userId, role);
    const updatedUser = await getUserById(userId);
    res.json({ success: true, data: updatedUser });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(400).json({ success: false, error: error.message });
  }
}

async function deleteUserAdmin(req, res) {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    await deleteUser(parseInt(userId));
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(400).json({ success: false, error: error.message });
  }
}

async function setUserPasswordAdmin(req, res) {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!userId || !newPassword) {
      return res.status(400).json({ success: false, error: 'User ID and newPassword are required' });
    }

    await setUserPassword(Number(userId), String(newPassword));
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error setting user password:', error);
    res.status(400).json({ success: false, error: error.message });
  }
}

module.exports = { getUsers, getAdminPanel, getAdminUsersJSON, createUserAdmin, updateUserRoleAdmin, deleteUserAdmin, setUserPasswordAdmin };
