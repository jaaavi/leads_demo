const express = require('express');
const path = require('path');
const multer = require('multer');
const { runScrape, batchRun, getJobs, runVariations } = require('../controllers/gapiController');
const { getPlaces, getPlacesMeta, getPlace, postPlace, putPlace, delPlace, createLeadFromPlace, createLeadsFromPlaces, bulkDeletePlaces, createLeadsFromPlacesAssign } = require('../controllers/placeController');
const { getLead, getLeads, postLead, putLead, removeLead, generate, getLeadMeta, getLeadActionsHandler, addLeadActionHandler, bulkAssignLeads, bulkDeleteLeads, sendLeadToPlaces } = require('../controllers/leadController');
const { getLeadStats, getLeadsFunnelStats, getMonthlyStats, getSourcePerformance, getUserPerformance } = require('../controllers/statsController');
const { getLoginPage, postLogin, logout } = require('../controllers/authController');
const { getUsers, getAdminPanel, getAdminUsersJSON, createUserAdmin, updateUserRoleAdmin, deleteUserAdmin, setUserPasswordAdmin } = require('../controllers/userController');
const { getSubdomainsPage, listSubdomains, createSubdomain } = require('../controllers/subdomainController');
const { getAdminDocumentation } = require('../controllers/documentationController');
const { getQRCode, sendMessage, getLeadMessagesHandler, getTemplatesHandler, createTemplateHandler, deleteTemplateHandler, getWhatsappStatus, disconnectWhatsapp, createUserInstance, getWhatsappStatusForUser, sendGroupMessage, testDailyPreview } = require('../controllers/whatsappController');
const { getAssignedLeads, updatePreviewDeliveryDate, searchLeads } = require('../controllers/calendarController');
const { initFunnel, getFunnel, sendOpeningMessage, updatePhase2, parsePhase2FromMessages, generatePhase3Prompt, sendPhase3Message, updatePhase4Preview, sendPhase4Message, togglePhaseCompletion } = require('../controllers/leadFunnelController');
const { getToolsPage, analyzeImages, getMetadata, deleteImage, downloadMetadata, downloadAnalyzedImage, downloadAnalyzedImagesAsZip, convertWebpToPng, convertToWebp, downloadConvertedImages, listConvertedImages, deleteConvertedImage, downloadConvertedImagesAsZip } = require('../controllers/toolsController');
const { getStrategiesPage, listStrategiesJSON, getStrategy, createStrategyHandler, updateStrategyHandler, deleteStrategyHandler, setActiveStrategyHandler, addStrategyMessage, updateStrategyMessageHandler, deleteStrategyMessageHandler } = require('../controllers/strategyController');
const { requireAuth, requireAuthJSON, requireRole, isLoggedIn, restrictByRole } = require('../middleware/auth');

const router = express.Router();

// Configure multer for image uploads
const upload = multer({
  dest: path.join(__dirname, '..', 'public', 'uploads', 'temp'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, and WebP are allowed.'));
    }
  }
});

// Middleware to restrict comercial users from certain routes
function allowAdminOnly(req, res, next) {
  const userRole = req.session?.userRole || 'admin';
  if (userRole === 'comercial') {
    return res.status(403).redirect('/leads');
  }
  next();
}

// Login routes (no auth required)
router.get('/login', isLoggedIn, getLoginPage);
router.post('/login', postLogin);
router.get('/logout', logout);

// Protected routes (auth required)
router.get('/', requireAuth, allowAdminOnly, restrictByRole, (req, res) => {
  res.render('index', { session: req.session });
});

// Manual/Documentation page (available for all authenticated users)
router.get('/manual', requireAuth, restrictByRole, (req, res) => {
  const userRole = req.session?.userRole || 'admin';
  // Comercial (non-pro) gets their specific guide with call scripts
  if (userRole === 'comercial') {
    return res.render('manual-comercial', { session: req.session });
  }
  // Comercial pro and admin get the full admin manual
  res.render('manual', { session: req.session });
});

// Admin routes (protected by admin role)
router.get('/admin/users', requireAuth, requireRole('admin'), restrictByRole, getAdminPanel);
router.get('/api/admin/users', requireAuthJSON, requireRole('admin'), getAdminUsersJSON);
router.post('/api/admin/users', requireAuthJSON, requireRole('admin'), createUserAdmin);
router.put('/api/admin/users/:userId/role', requireAuthJSON, requireRole('admin'), updateUserRoleAdmin);
    router.put('/api/admin/users/:userId/password', requireAuthJSON, requireRole('admin'), setUserPasswordAdmin);
    router.delete('/api/admin/users/:userId', requireAuthJSON, requireRole('admin'), deleteUserAdmin);

// Admin Subdomains
router.get('/admin/subdomains', requireAuth, requireRole('admin'), restrictByRole, getSubdomainsPage);
router.get('/api/admin/subdomains', requireAuthJSON, requireRole('admin'), listSubdomains);
router.post('/api/admin/subdomains', requireAuthJSON, requireRole('admin'), createSubdomain);

// Admin Documentation
router.get('/admin/documentation', requireAuth, requireRole('admin'), restrictByRole, getAdminDocumentation);

// Admin Tools
router.get('/admin/tools', requireAuth, requireRole('admin'), restrictByRole, getToolsPage);
router.post('/api/admin/tools/analyze', requireAuthJSON, requireRole('admin'), upload.array('images', 20), analyzeImages);
router.get('/api/admin/tools/metadata', requireAuthJSON, requireRole('admin'), getMetadata);
router.delete('/api/admin/tools/image/:id', requireAuthJSON, requireRole('admin'), deleteImage);
router.get('/api/admin/tools/metadata/download', requireAuthJSON, requireRole('admin'), downloadMetadata);
router.get('/api/admin/tools/image/:filename/download', requireAuthJSON, requireRole('admin'), downloadAnalyzedImage);
router.get('/api/admin/tools/images/download-zip', requireAuthJSON, requireRole('admin'), downloadAnalyzedImagesAsZip);

// Image Conversion Tools
router.post('/api/admin/tools/convert/webp-to-png', requireAuthJSON, requireRole('admin'), upload.array('images', 50), convertWebpToPng);
router.post('/api/admin/tools/convert/to-webp', requireAuthJSON, requireRole('admin'), upload.array('images', 50), convertToWebp);
router.get('/api/admin/tools/converted/:type', requireAuthJSON, requireRole('admin'), listConvertedImages);
router.delete('/api/admin/tools/converted/:type/:filename', requireAuthJSON, requireRole('admin'), deleteConvertedImage);
router.get('/api/admin/tools/converted/:type/download', requireAuthJSON, requireRole('admin'), downloadConvertedImages);
router.get('/api/admin/tools/converted/:type/download-zip', requireAuthJSON, requireRole('admin'), downloadConvertedImagesAsZip);

// Strategies (available for admin and comercial_pro)
router.get('/admin/strategies', requireAuth, requireRole(['admin', 'comercial_pro']), restrictByRole, getStrategiesPage);
router.get('/api/admin/strategies', requireAuthJSON, requireRole(['admin', 'comercial_pro']), listStrategiesJSON);
router.get('/api/admin/strategies/:id', requireAuthJSON, requireRole(['admin', 'comercial_pro']), getStrategy);
router.post('/api/admin/strategies', requireAuthJSON, requireRole(['admin', 'comercial_pro']), createStrategyHandler);
router.put('/api/admin/strategies/:id', requireAuthJSON, requireRole(['admin', 'comercial_pro']), updateStrategyHandler);
router.delete('/api/admin/strategies/:id', requireAuthJSON, requireRole(['admin', 'comercial_pro']), deleteStrategyHandler);
router.post('/api/admin/strategies/:id/activate', requireAuthJSON, requireRole(['admin', 'comercial_pro']), setActiveStrategyHandler);
router.post('/api/admin/strategies/:strategyId/messages', requireAuthJSON, requireRole(['admin', 'comercial_pro']), addStrategyMessage);
router.put('/api/admin/strategies/:strategyId/messages/:messageId', requireAuthJSON, requireRole(['admin', 'comercial_pro']), updateStrategyMessageHandler);
router.delete('/api/admin/strategies/:strategyId/messages/:messageId', requireAuthJSON, requireRole(['admin', 'comercial_pro']), deleteStrategyMessageHandler);

// API endpoints (all protected)
router.get('/users', requireAuthJSON, getUsers);
router.post('/gapi/run', requireAuthJSON, runScrape);
router.post('/gapi/batch', requireAuthJSON, batchRun);
router.post('/gapi/variations', requireAuthJSON, runVariations);
router.get('/gapi/jobs', requireAuthJSON, getJobs);

// Stats - unified handler for HTML view or JSON API
router.get('/stats', requireAuth, restrictByRole, (req, res) => {
  const accept = req.headers.accept || '';
  const wantsJson = accept.includes('application/json');

  // If explicitly requesting JSON, return JSON data
  if (wantsJson) {
    return getLeadStats(req, res);
  }

  // Default browser request, render HTML page
  res.render('stats', { session: req.session });
});

// More specific stats API routes
router.get('/stats/funnel', requireAuthJSON, getLeadsFunnelStats);
router.get('/stats/monthly', requireAuthJSON, getMonthlyStats);
router.get('/stats/source-performance', requireAuthJSON, getSourcePerformance);
router.get('/stats/user-performance', requireAuthJSON, getUserPerformance);

// If client wants HTML, render the places view, otherwise continue to API JSON
router.get('/places', requireAuth, restrictByRole, (req, res, next) => {
  const accept = req.headers.accept || '';
  // If client explicitly prefers JSON, skip HTML rendering
  if (!accept.includes('application/json') && req.accepts('html')) {
    return res.render('places', { session: req.session });
  }
  return next();
}, getPlaces);

router.get('/places/meta', requireAuthJSON, getPlacesMeta);
router.post('/places/bulk/create-leads', requireAuthJSON, createLeadsFromPlaces);
router.post('/places/bulk/create-leads-assign', requireAuthJSON, createLeadsFromPlacesAssign);
router.post('/places/bulk/delete', requireAuthJSON, bulkDeletePlaces);
router.post('/places/:id/create-lead', requireAuthJSON, createLeadFromPlace);
router.get('/places/:id', requireAuthJSON, getPlace);
router.post('/places', requireAuthJSON, postPlace);
router.put('/places/:id', requireAuthJSON, putPlace);
router.delete('/places/:id', requireAuthJSON, delPlace);

// locations (saved)
const { postLocation, getLocations } = require('../controllers/locationController');
router.post('/locations', requireAuthJSON, postLocation);
router.get('/locations', requireAuthJSON, getLocations);

// If client wants HTML, render the leads view, otherwise continue to API JSON
router.get('/leads', requireAuth, restrictByRole, (req, res, next) => {
  const accept = req.headers.accept || '';
  // If client explicitly prefers JSON, skip HTML rendering
  if (!accept.includes('application/json') && req.accepts('html')) {
    return res.render('leads', { session: req.session });
  }
  return next();
}, getLeads);
router.get('/leads/meta', requireAuthJSON, getLeadMeta);
router.post('/leads/bulk/assign', requireAuthJSON, bulkAssignLeads);
router.get('/leads/:lead_id/actions', requireAuthJSON, getLeadActionsHandler);
router.post('/leads/:lead_id/actions', requireAuthJSON, addLeadActionHandler);
router.post('/leads/generate', requireAuthJSON, generate);
router.get('/leads/:id', requireAuthJSON, getLead);
router.post('/leads', requireAuthJSON, postLead);
router.put('/leads/:id', requireAuthJSON, putLead);
router.delete('/leads/:id', requireAuthJSON, removeLead);
router.post('/leads/:id/send-to-places', requireAuthJSON, sendLeadToPlaces);
router.post('/leads/bulk/delete', requireAuthJSON, bulkDeleteLeads);

// Calendar routes: HTML page and JSON API for assigned user's leads
router.get('/calendar', requireAuth, restrictByRole, (req, res) => {
  const accept = req.headers.accept || '';
  // Render HTML for normal browser requests
  if (!accept.includes('application/json') && req.accepts('html')) {
    return res.render('calendar', { session: req.session });
  }
  // otherwise return OK JSON
  return res.json({ ok: true });
});

router.get('/api/calendar/leads', requireAuthJSON, getAssignedLeads);
router.get('/api/calendar/leads/search', requireAuthJSON, searchLeads);
router.put('/api/calendar/leads/:id', requireAuthJSON, updatePreviewDeliveryDate);

// WhatsApp API routes (must be before /whatsapp HTML route)
router.get('/whatsapp/qr', requireAuthJSON, getQRCode);
router.post('/whatsapp/send-message', requireAuthJSON, sendMessage);
router.post('/whatsapp/send-group-message', requireAuthJSON, requireRole('admin'), sendGroupMessage);
router.post('/whatsapp/test-daily-preview', requireAuthJSON, requireRole('admin'), testDailyPreview);
router.get('/whatsapp/messages/:lead_id', requireAuthJSON, getLeadMessagesHandler);
router.get('/whatsapp/status', requireAuthJSON, getWhatsappStatus);
router.post('/whatsapp/disconnect', requireAuthJSON, disconnectWhatsapp);
router.get('/whatsapp/templates', requireAuthJSON, getTemplatesHandler);
router.post('/whatsapp/templates', requireAuthJSON, createTemplateHandler);
router.delete('/whatsapp/templates/:id', requireAuthJSON, deleteTemplateHandler);

// User-specific instance management (for comercial_pro)
router.post('/whatsapp/instances', requireAuthJSON, createUserInstance);
router.get('/whatsapp/instances/status', requireAuthJSON, getWhatsappStatusForUser);

// Server-Sent Events endpoint for realtime updates
const { events: whatsappEvents } = require('../services/whatsappService');
router.get('/events', requireAuth, (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  const sendEvent = (name, data) => {
    try {
      res.write(`event: ${name}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) { /* ignore */ }
  };

  const onInbound = (payload) => sendEvent('message.inbound', payload);
  const onFunnel = (payload) => sendEvent('funnel.update', payload);

  whatsappEvents.on('message.inbound', onInbound);
  whatsappEvents.on('funnel.update', onFunnel);

  // Keep connection alive with comments every 30s
  const keepAlive = setInterval(() => {
    try { res.write(': keep-alive\n\n'); } catch (e) {}
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
    whatsappEvents.removeListener('message.inbound', onInbound);
    whatsappEvents.removeListener('funnel.update', onFunnel);
  });
});

// WhatsApp - render HTML view (must be last)
router.get('/whatsapp', requireAuth, restrictByRole, (req, res) => {
  res.render('whatsapp', { session: req.session });
});

// Lead Funnel API routes
router.post('/leads/:leadId/funnel/init', requireAuthJSON, initFunnel);
router.get('/leads/:leadId/funnel', requireAuthJSON, getFunnel);
router.post('/leads/:leadId/funnel/phase1/send', requireAuthJSON, sendOpeningMessage);
router.post('/leads/:leadId/funnel/phase2/update', requireAuthJSON, updatePhase2);
   router.post('/leads/:leadId/funnel/phase2/parse', requireAuthJSON, parsePhase2FromMessages);
   router.post('/leads/:leadId/funnel/phase3/generate', requireAuthJSON, generatePhase3Prompt);
   router.post('/leads/:leadId/funnel/phase3/send', requireAuthJSON, sendPhase3Message);
router.post('/leads/:leadId/funnel/phase4/preview', requireAuthJSON, updatePhase4Preview);
router.post('/leads/:leadId/funnel/phase/:phase/toggle', requireAuthJSON, togglePhaseCompletion);
router.post('/leads/:leadId/funnel/phase4/send', requireAuthJSON, sendPhase4Message);

module.exports = router;
