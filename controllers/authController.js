const { getUserByUsername, verifyPassword } = require('../models/userModel');

async function getLoginPage(req, res) {
  res.render('login');
}

async function postLogin(req, res) {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).render('login', { error: 'Username y password son requeridos' });
    }

    const user = await getUserByUsername(username);
    if (!user) {
      return res.status(401).render('login', { error: 'Credenciales inválidas' });
    }

    const passwordMatch = await verifyPassword(user, password);
    if (!passwordMatch) {
      return res.status(401).render('login', { error: 'Credenciales inválidas' });
    }

    // Crear sesión
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.email = user.email;
    req.session.userRole = user.role || 'admin';
    req.session.accessibleViews = user.accessible_views ? JSON.parse(user.accessible_views) : [];

    // Save session to store before redirecting
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).render('login', { error: 'Error al guardar sesión' });
      }
      console.log(`User ${user.username} (role: ${req.session.userRole}) logged in successfully`);
      res.redirect('/');
    });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).render('login', { error: 'Error interno del servidor' });
  }
}

function logout(req, res) {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Error al cerrar sesión' });
    }
    res.redirect('/login');
  });
}

module.exports = {
  getLoginPage,
  postLogin,
  logout,
};
