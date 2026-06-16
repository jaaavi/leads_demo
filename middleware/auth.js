function requireAuth(req, res, next) {
  if (!req.session) {
    console.warn('No session found in request');
    return res.redirect('/login');
  }

  if (!req.session.userId) {
    console.warn('No userId in session - user not authenticated');
    return res.redirect('/login');
  }

  console.log(`User ${req.session.username} (role: ${req.session.userRole || 'admin'}) accessing protected route: ${req.path}`);
  next();
}

function requireAuthJSON(req, res, next) {
  if (!req.session) {
    console.warn('No session found for JSON request');
    return res.status(401).json({ error: 'Unauthorized - No session' });
  }

  if (!req.session.userId) {
    console.warn('No userId in session for JSON request');
    return res.status(401).json({ error: 'Unauthorized - Not authenticated' });
  }

  next();
}

function requireRole(roleRequired) {
  return (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized - Not authenticated' });
    }

    const userRole = req.session.userRole || 'admin';

    if (Array.isArray(roleRequired)) {
      if (!roleRequired.includes(userRole)) {
        console.warn(`User ${req.session.username} (role: ${userRole}) denied access to route requiring roles: ${roleRequired.join(', ')}`);
        return res.status(403).json({ error: `Access denied. This feature requires one of these roles: ${roleRequired.join(', ')}` });
      }
    } else {
      if (userRole !== roleRequired) {
        console.warn(`User ${req.session.username} (role: ${userRole}) denied access to route requiring role: ${roleRequired}`);
        return res.status(403).json({ error: `Access denied. This feature requires ${roleRequired} role` });
      }
    }

    next();
  };
}

function isLoggedIn(req, res, next) {
  if (req.session && req.session.userId) {
    console.log(`User ${req.session.username} already logged in, redirecting to /`);
    return res.redirect('/');
  }
  next();
}

function restrictByRole(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).redirect('/login');
  }

  const userRole = req.session.userRole || 'admin';
  const requestPath = req.path;

  // Admin can access everything
  if (userRole === 'admin') {
    return next();
  }

  // Define allowed routes for each non-admin role
  const allowedRoutes = {
    comercial: ['/leads', '/stats', '/calendar', '/manual', '/logout'],
    comercial_pro: ['/places', '/leads', '/stats', '/calendar', '/whatsapp', '/admin/strategies', '/manual', '/logout']
  };

  const userAllowedRoutes = allowedRoutes[userRole] || [];

  // Check if the current path is allowed
  const isAllowed = userAllowedRoutes.some(route => {
    if (route === requestPath) return true;
    // Allow sub-paths like /leads/123, /places/456, etc.
    if (requestPath.startsWith(route + '/')) return true;
    return false;
  });

  if (!isAllowed) {
    console.warn(`User ${req.session.username} (role: ${userRole}) attempted to access unauthorized route: ${requestPath}`);
    const accept = req.headers.accept || '';
    if (accept.includes('application/json')) {
      return res.status(403).json({ error: 'Access denied. This page is not available for your role.' });
    }
    return res.status(403).redirect('/leads');
  }

  next();
}

module.exports = {
  requireAuth,
  requireAuthJSON,
  requireRole,
  isLoggedIn,
  restrictByRole,
};
