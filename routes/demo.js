const express = require('express');
const data = require('../db/demoData');

const router = express.Router();

let nextPlaceId = Math.max(...data.places.map((p) => p.id)) + 1;
let nextLeadId = Math.max(...data.leads.map((l) => l.id)) + 1;
let nextUserId = Math.max(...data.users.map((u) => u.id)) + 1;
let nextActionId = Math.max(...data.leadActions.map((a) => a.id)) + 1;

const pageViews = {
  '/': 'index',
  '/places': 'places',
  '/leads': 'leads',
  '/stats': 'stats',
  '/calendar': 'calendar',
  '/whatsapp': 'whatsapp',
  '/manual': 'manual',
  '/admin/users': 'admin/users',
  '/admin/subdomains': 'admin/subdomains',
  '/admin/documentation': 'admin/documentation',
  '/admin/tools': 'admin/tools',
  '/admin/strategies': 'admin/strategies',
};

function activeRows(rows) {
  return rows.filter((row) => !row.deleted_at);
}

function paginate(rows, page = 1, pageSize = 20) {
  const currentPage = Number(page) || 1;
  const size = Number(pageSize) || 20;
  const start = (currentPage - 1) * size;
  return {
    data: rows.slice(start, start + size),
    total: rows.length,
    page: currentPage,
    pageSize: size,
  };
}

function contains(value, query) {
  return String(value || '').toLowerCase().includes(String(query || '').toLowerCase());
}

function unique(rows, field) {
  return [...new Set(rows.map((row) => row[field]).filter(Boolean))].sort();
}

function demoSession(req, _res, next) {
  if (!req.session.userId) {
    req.session.userId = 1;
    req.session.username = 'demo_admin';
    req.session.email = 'demo-admin@example.com';
    req.session.userRole = 'admin';
    req.session.accessibleViews = [];
  }
  next();
}

function renderOrJson(view, jsonHandler) {
  return (req, res) => {
    const accept = req.headers.accept || '';
    if (!accept.includes('application/json') && req.accepts('html')) {
      return res.render(view, { session: req.session });
    }
    return jsonHandler(req, res);
  };
}

function normalizeLead(lead) {
  const user = data.users.find((u) => u.id === Number(lead.assigned_to));
  const phase = data.funnel[lead.id];
  const hasReplied = data.whatsappMessages.some((m) => m.lead_id === lead.id && m.direction === 'inbound');
  return {
    ...lead,
    assigned_username: user?.username || lead.assigned_username || null,
    funnel_phase: phase?.current_phase || null,
    place_city: lead.city,
    place_barrio: lead.barrio,
    has_replied: hasReplied ? 1 : 0,
  };
}

function filterPlaces(req) {
  const { mainCategory, city, barrio, hasWeb, hasPhone, q, tag, phoneType, jobId } = req.query;
  return activeRows(data.places)
    .filter((place) => !mainCategory || place.main_category === mainCategory)
    .filter((place) => !city || place.city === city)
    .filter((place) => !barrio || place.barrio === barrio)
    .filter((place) => !jobId || Number(place.job_id) === Number(jobId))
    .filter((place) => !phoneType || phoneType === 'all' || place.phone_type === phoneType)
    .filter((place) => hasPhone !== '1' || !!place.phone)
    .filter((place) => hasPhone !== '0' || !place.phone)
    .filter((place) => hasWeb !== '1' || (!!place.web && !contains(place.web, 'instagram.com') && !contains(place.web, 'facebook.com')))
    .filter((place) => hasWeb !== '0' || !place.web)
    .filter((place) => hasWeb !== 'social' || contains(place.web, 'instagram.com') || contains(place.web, 'facebook.com'))
    .filter((place) => !tag || contains(place.tags, tag))
    .filter((place) => !q || ['name', 'main_category', 'raw_categories', 'tags', 'city'].some((field) => contains(place[field], q)))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function filterLeads(req) {
  const { status, source, city, barrio, phone_type, q, assigned_to, pending_reply, has_web, funnel_phase: funnelPhase, jobId } = req.query;
  return activeRows(data.leads)
    .map(normalizeLead)
    .filter((lead) => !status || lead.status === status)
    .filter((lead) => !source || lead.source === source)
    .filter((lead) => !city || lead.city === city)
    .filter((lead) => !barrio || lead.barrio === barrio)
    .filter((lead) => !jobId || data.places.some((place) => place.lead_id === lead.id && Number(place.job_id) === Number(jobId)))
    .filter((lead) => !phone_type || phone_type === 'all' || lead.phone_type === phone_type)
    .filter((lead) => assigned_to !== 'null' || !lead.assigned_to)
    .filter((lead) => assigned_to === undefined || assigned_to === '' || assigned_to === 'null' || Number(lead.assigned_to) === Number(assigned_to))
    .filter((lead) => has_web !== '1' || !!lead.web)
    .filter((lead) => has_web !== '0' || !lead.web)
    .filter((lead) => pending_reply !== '1' || !!lead.has_replied)
    .filter((lead) => !funnelPhase || Number(lead.funnel_phase) === Number(funnelPhase))
    .filter((lead) => !q || ['full_name', 'email', 'phone', 'notes', 'tags'].some((field) => contains(lead[field], q)))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function addAction(leadId, req, action_type, action_description, old_value = null, new_value = null) {
  data.leadActions.unshift({
    id: nextActionId++,
    lead_id: Number(leadId),
    user_id: req.session.userId,
    username: req.session.username,
    action_type,
    action_description,
    old_value,
    new_value,
    created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
  });
}

router.use(demoSession);

router.get('/login', (req, res) => res.render('login', {
  error: null,
  demoMode: true,
  session: req.session,
}));

router.post('/login', (req, res) => {
  const requestedRole = req.body?.username === 'demo_comercial' ? data.users[1] : data.users[0];
  req.session.userId = requestedRole.id;
  req.session.username = requestedRole.username;
  req.session.email = requestedRole.email;
  req.session.userRole = requestedRole.role;
  req.session.accessibleViews = [];
  res.redirect('/');
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

Object.entries(pageViews).forEach(([route, view]) => {
  router.get(route, (req, res, next) => {
    if (route === '/places') return next();
    if (route === '/leads') return next();
    if (route === '/stats') return next();
    if (route === '/admin/subdomains') {
      return res.render(view, { session: req.session, domain: 'demo-leads.example' });
    }
    res.render(view, { session: req.session });
  });
});

router.get('/places', renderOrJson('places', (req, res) => {
  res.json(paginate(filterPlaces(req), req.query.page, req.query.pageSize));
}));

router.get('/places/meta', (req, res) => {
  const rows = activeRows(data.places);
  res.json({
    ok: true,
    categories: unique(rows, 'main_category'),
    tags: unique(rows.flatMap((p) => String(p.tags || '').split(',').map((tag) => ({ tag: tag.trim() }))), 'tag'),
    cities: unique(rows, 'city'),
    barrios: unique(rows, 'barrio'),
    phoneTypes: unique(rows, 'phone_type'),
    jobs: data.jobs,
  });
});

router.get('/places/:id', (req, res) => {
  const place = activeRows(data.places).find((p) => p.id === Number(req.params.id));
  if (!place) return res.status(404).json({ error: 'No encontrado' });
  res.json(place);
});

router.post('/places', (req, res) => {
  const place = {
    id: nextPlaceId++,
    name: req.body.name || 'Nuevo place demo',
    main_category: req.body.main_category || req.body.mainCategory || req.body.category || 'Demo',
    raw_categories: req.body.raw_categories || req.body.rawCategories || null,
    tags: req.body.tags || '',
    notes: req.body.notes || 'Registro creado en modo demo.',
    place_id: req.body.place_id || `demo-place-${nextPlaceId}`,
    phone: req.body.phone || '',
    phone_type: req.body.phone_type || 'mobile',
    web: req.body.web || '',
    street_address: req.body.street_address || '',
    city: req.body.city || '',
    barrio: req.body.barrio || '',
    zip: req.body.zip || '',
    state: req.body.state || '',
    country_code: req.body.country_code || 'ES',
    latitude: req.body.latitude || null,
    longitude: req.body.longitude || null,
    source_query: req.body.source_query || 'demo manual',
    lead_id: null,
    user_id: req.session.userId,
    job_id: null,
    created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    deleted_at: null,
  };
  data.places.unshift(place);
  res.json({ ok: true, id: place.id });
});

router.put('/places/:id', (req, res) => {
  const place = data.places.find((p) => p.id === Number(req.params.id));
  if (!place) return res.status(404).json({ error: 'No encontrado' });
  Object.assign(place, req.body);
  res.json({ ok: true });
});

router.delete('/places/:id', (req, res) => {
  const place = data.places.find((p) => p.id === Number(req.params.id));
  if (place) place.deleted_at = new Date().toISOString();
  res.json({ ok: true, affected: place ? 1 : 0 });
});

router.post('/places/:id/create-lead', (req, res) => {
  const place = activeRows(data.places).find((p) => p.id === Number(req.params.id));
  if (!place) return res.status(404).json({ error: 'place not found' });
  const lead = {
    id: nextLeadId++,
    user_id: req.session.userId,
    full_name: place.name,
    email: '',
    phone: place.phone,
    city: place.city,
    barrio: place.barrio,
    phone_type: place.phone_type,
    source: 'scraper',
    status: 'new',
    notes: `Demo: lead creado desde place ${place.id}`,
    assigned_to: null,
    estimated_value: 0,
    estimated_benefit: 0,
    contact_method: null,
    tags: place.tags,
    web: place.web,
    preview_delivery_date: null,
    created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    deleted_at: null,
  };
  data.leads.unshift(lead);
  place.lead_id = lead.id;
  addAction(lead.id, req, 'created', `Lead demo creado desde place ${place.id}`);
  res.json({ ok: true, lead: { id: lead.id } });
});

router.post('/places/bulk/create-leads', (req, res) => {
  const ids = Array.isArray(req.body.place_ids) ? req.body.place_ids : [];
  const results = ids.map((id) => ({ place_id: Number(id), success: true, lead_id: Number(id) + 1000 }));
  res.json({ ok: true, results, converted: results.length });
});

router.post('/places/bulk/create-leads-assign', (req, res) => {
  const ids = Array.isArray(req.body.place_ids) ? req.body.place_ids : [];
  const results = ids.map((id) => ({ place_id: Number(id), success: true, lead_id: Number(id) + 1000 }));
  res.json({ ok: true, results, converted: results.length });
});

router.post('/places/bulk/delete', (req, res) => {
  const ids = Array.isArray(req.body.place_ids) ? req.body.place_ids.map(Number) : [];
  let deleted = 0;
  data.places.forEach((place) => {
    if (ids.includes(place.id) && !place.deleted_at) {
      place.deleted_at = new Date().toISOString();
      deleted += 1;
    }
  });
  res.json({ ok: true, deleted });
});

router.get('/leads', renderOrJson('leads', (req, res) => {
  res.json(paginate(filterLeads(req), req.query.page, req.query.pageSize));
}));

router.get('/leads/meta', (req, res) => {
  const rows = activeRows(data.leads);
  res.json({
    ok: true,
    sources: unique(rows, 'source'),
    contactMethods: unique(rows, 'contact_method'),
    cities: unique(rows, 'city'),
    barrios: unique(rows, 'barrio'),
    phoneTypes: unique(rows, 'phone_type'),
    jobs: data.jobs,
  });
});

router.get('/leads/:lead_id/actions', (req, res) => {
  res.json(data.leadActions.filter((action) => action.lead_id === Number(req.params.lead_id)));
});

router.post('/leads/:lead_id/actions', (req, res) => {
  addAction(req.params.lead_id, req, req.body.action_type || 'note', req.body.action_description || req.body.description || 'Acción demo');
  res.json({ ok: true });
});

router.get('/leads/:id', (req, res) => {
  const lead = activeRows(data.leads).map(normalizeLead).find((l) => l.id === Number(req.params.id));
  if (!lead) return res.status(404).json({ error: 'No encontrado' });
  res.json(lead);
});

router.post('/leads', (req, res) => {
  const lead = {
    id: nextLeadId++,
    user_id: req.session.userId,
    full_name: req.body.full_name || 'Nuevo lead demo',
    email: req.body.email || '',
    phone: req.body.phone || '',
    city: req.body.city || '',
    barrio: req.body.barrio || '',
    phone_type: req.body.phone_type || 'mobile',
    source: req.body.source || 'manual',
    status: req.body.status || 'new',
    notes: req.body.notes || 'Registro creado en modo demo.',
    assigned_to: req.body.assigned_to || null,
    estimated_value: Number(req.body.estimated_value) || 0,
    estimated_benefit: Number(req.body.estimated_benefit) || 0,
    contact_method: req.body.contact_method || null,
    tags: req.body.tags || '',
    web: req.body.web || '',
    preview_delivery_date: req.body.preview_delivery_date || null,
    created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    deleted_at: null,
  };
  data.leads.unshift(lead);
  addAction(lead.id, req, 'created', 'Lead demo creado manualmente');
  res.json({ ok: true, id: lead.id });
});

router.put('/leads/:id', (req, res) => {
  const lead = data.leads.find((l) => l.id === Number(req.params.id));
  if (!lead) return res.status(404).json({ error: 'No encontrado' });
  const oldStatus = lead.status;
  Object.assign(lead, req.body);
  if (req.body.status && req.body.status !== oldStatus) {
    addAction(lead.id, req, 'updated_status', 'status actualizado', oldStatus, req.body.status);
  }
  res.json({ ok: true });
});

router.delete('/leads/:id', (req, res) => {
  const lead = data.leads.find((l) => l.id === Number(req.params.id));
  if (lead) lead.deleted_at = new Date().toISOString();
  res.json({ ok: true, affected: lead ? 1 : 0 });
});

router.post('/leads/bulk/assign', (req, res) => {
  const ids = Array.isArray(req.body.lead_ids) ? req.body.lead_ids.map(Number) : [];
  data.leads.forEach((lead) => {
    if (ids.includes(lead.id)) lead.assigned_to = Number(req.body.assign_to || req.body.assigned_to) || null;
  });
  res.json({ ok: true, updated: ids.length });
});

router.post('/leads/bulk/delete', (req, res) => {
  const ids = Array.isArray(req.body.lead_ids) ? req.body.lead_ids.map(Number) : [];
  let deleted = 0;
  data.leads.forEach((lead) => {
    if (ids.includes(lead.id) && !lead.deleted_at) {
      lead.deleted_at = new Date().toISOString();
      deleted += 1;
    }
  });
  res.json({ ok: true, deleted });
});

router.post('/leads/generate', (_req, res) => res.json({ ok: true, created: 2, demo: true }));
router.post('/leads/:id/send-to-places', (_req, res) => res.json({ ok: true, demo: true }));

router.get('/users', (_req, res) => res.json({ data: data.users.map((user) => ({ id: user.id, username: user.username })) }));
router.get('/api/admin/users', (_req, res) => res.json({ success: true, data: data.users }));
router.post('/api/admin/users', (req, res) => {
  const user = {
    id: nextUserId++,
    username: req.body.username || `demo_user_${nextUserId}`,
    email: req.body.email || `demo-user-${nextUserId}@example.com`,
    role: req.body.role || 'comercial',
    accessible_views: '[]',
    created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
  };
  data.users.unshift(user);
  res.json({ success: true, data: user });
});
router.put('/api/admin/users/:userId/role', (req, res) => {
  const user = data.users.find((u) => u.id === Number(req.params.userId));
  if (user) user.role = req.body.role || user.role;
  res.json({ success: true, data: user });
});
router.put('/api/admin/users/:userId/password', (_req, res) => res.json({ success: true, demo: true }));
router.delete('/api/admin/users/:userId', (req, res) => {
  const index = data.users.findIndex((u) => u.id === Number(req.params.userId));
  if (index > -1) data.users.splice(index, 1);
  res.json({ success: true });
});

router.get('/api/admin/subdomains', (_req, res) => res.json({ ok: true, records: [
  { name: 'demo-clinica.demo-leads.example', content: '192.0.2.10', ttl: 1, proxied: true },
  { name: 'demo-fitness.demo-leads.example', content: '192.0.2.11', ttl: 1, proxied: true },
] }));
router.post('/api/admin/subdomains', (req, res) => res.json({ ok: true, record: {
  name: `${req.body.subdomain}.demo-leads.example`,
  content: '192.0.2.99',
  ttl: 1,
  proxied: true,
}, demo: true }));

router.get('/api/admin/strategies', (_req, res) => res.json({
  ok: true,
  data: [
    {
      id: 1,
      name: 'Demo captación local',
      description: 'Secuencia mock para negocios sin web',
      isActive: true,
      created_at: data.jobs[0].created_at,
      messages: [
        { id: 1, message_type: 'APERTURA', content: 'Hola, he visto vuestro negocio y creo que una web clara os ayudaría a captar más clientes.' },
        { id: 2, message_type: 'RECOPILACION', content: 'Para preparar una propuesta, ¿qué servicio queréis priorizar este mes?' },
        { id: 3, message_type: 'PREVISUALIZACION', content: 'Os dejo una previsualización demo para revisar el enfoque visual.' },
      ],
    },
  ],
}));
router.get('/api/admin/strategies/:id', (req, res) => res.json({
  ok: true,
  data: {
    id: Number(req.params.id),
    name: 'Demo captación local',
    description: 'Secuencia mock para negocios sin web',
    isActive: true,
    messages: [
      { id: 1, message_type: 'APERTURA', content: 'Mensaje inicial demo', phase: 1 },
      { id: 2, message_type: 'RECOPILACION', content: 'Seguimiento demo', phase: 2 },
    ],
  },
  strategy: { id: Number(req.params.id), name: 'Demo captación local', description: 'Secuencia mock para negocios sin web', active: 1 },
  messages: [
    { id: 1, phase: 1, content: 'Mensaje inicial demo', delay_hours: 0 },
    { id: 2, phase: 2, content: 'Seguimiento demo', delay_hours: 24 },
  ],
}));
router.post('/api/admin/strategies', (_req, res) => res.json({ ok: true, id: 99, demo: true }));
router.put('/api/admin/strategies/:id', (_req, res) => res.json({ ok: true, demo: true }));
router.delete('/api/admin/strategies/:id', (_req, res) => res.json({ ok: true, demo: true }));
router.post('/api/admin/strategies/:id/activate', (_req, res) => res.json({ ok: true, demo: true }));
router.post('/api/admin/strategies/:strategyId/messages', (_req, res) => res.json({ ok: true, id: 99, demo: true }));
router.put('/api/admin/strategies/:strategyId/messages/:messageId', (_req, res) => res.json({ ok: true, demo: true }));
router.delete('/api/admin/strategies/:strategyId/messages/:messageId', (_req, res) => res.json({ ok: true, demo: true }));

router.get('/stats', renderOrJson('stats', (_req, res) => {
  const leads = activeRows(data.leads);
  const statusBreakdown = leads.reduce((acc, lead) => ({ ...acc, [lead.status]: (acc[lead.status] || 0) + 1 }), {});
  const closed = statusBreakdown.closed || 0;
  const totalValue = leads.reduce((sum, lead) => sum + Number(lead.estimated_value || 0), 0);
  res.json({
    summary: {
      totalLeads: leads.length,
      closed,
      conversionRate: leads.length ? Math.round((closed / leads.length) * 100) : 0,
      totalValue,
      costPerLead: leads.length ? Math.round(totalValue / leads.length) : 0,
      avgClosingDays: 12,
    },
    statusBreakdown,
  });
}));
router.get('/stats/funnel', (_req, res) => res.json({ funnel: {
  new: 1,
  contacted: 1,
  interested: 1,
  negotiation: 0,
  closed: 0,
} }));
router.get('/stats/monthly', (_req, res) => res.json({ monthly: [
  { month: '2026-04', leads_created: 4, leads_closed: 1 },
  { month: '2026-05', leads_created: 8, leads_closed: 2 },
  { month: '2026-06', leads_created: 3, leads_closed: 0 },
] }));
router.get('/stats/source-performance', (_req, res) => res.json({ performance: [
  { source: 'scraper', totalLeads: 2, closedLeads: 0, conversionRate: 0, totalRevenue: 2800 },
  { source: 'manual', totalLeads: 1, closedLeads: 0, conversionRate: 0, totalRevenue: 900 },
] }));
router.get('/stats/user-performance', (_req, res) => res.json({ ok: true, data: data.users.map((user) => ({
  username: user.username,
  total: data.leads.filter((lead) => lead.assigned_to === user.id).length,
})), performance: data.users.map((user) => {
  const userLeads = data.leads.filter((lead) => lead.assigned_to === user.id);
  const leadsClosed = userLeads.filter((lead) => lead.status === 'closed').length;
  return {
    username: user.username,
    leadsManaged: userLeads.length,
    leadsClosed,
    successRate: userLeads.length ? Math.round((leadsClosed / userLeads.length) * 100) : 0,
    totalRevenue: userLeads.reduce((sum, lead) => sum + Number(lead.estimated_value || 0), 0),
  };
}) }));

router.get('/api/calendar/leads', (_req, res) => res.json({ ok: true, leads: activeRows(data.leads).map(normalizeLead) }));
router.get('/api/calendar/leads/search', (req, res) => res.json({ ok: true, leads: filterLeads(req).slice(0, 10) }));
router.put('/api/calendar/leads/:id', (req, res) => {
  const lead = data.leads.find((l) => l.id === Number(req.params.id));
  if (lead) lead.preview_delivery_date = req.body.preview_delivery_date || req.body.date || lead.preview_delivery_date;
  res.json({ ok: true });
});

router.post('/gapi/run', (_req, res) => res.json({ ok: true, job: data.jobs[0], demo: true }));
router.post('/gapi/batch', (_req, res) => res.json({ ok: true, jobs: data.jobs, demo: true }));
router.post('/gapi/variations', (req, res) => res.json({ ok: true, variations: [
  `${req.body.lugar || 'negocios'} cerca de mí`,
  `${req.body.lugar || 'negocios'} con mala web`,
  `${req.body.lugar || 'negocios'} sin página web`,
] }));
router.get('/gapi/jobs', (_req, res) => res.json({ ok: true, jobs: data.jobs }));

router.post('/locations', (req, res) => res.json({ ok: true, id: 1, location: req.body }));
router.get('/locations', (_req, res) => res.json({ ok: true, locations: [
  { id: 1, name: 'Madrid Centro', lat: 40.4168, lng: -3.7038 },
  { id: 2, name: 'Barcelona Eixample', lat: 41.3874, lng: 2.1686 },
] }));

router.get('/whatsapp/qr', (_req, res) => res.json({ ok: true, qr: null, connected: false, demo: true }));
router.post('/whatsapp/send-message', (_req, res) => res.json({ ok: true, message: 'Mensaje simulado en modo demo' }));
router.post('/whatsapp/send-group-message', (_req, res) => res.json({ ok: true, demo: true }));
router.post('/whatsapp/test-daily-preview', (_req, res) => res.json({ ok: true, demo: true }));
router.get('/whatsapp/messages/:lead_id', (req, res) => res.json({
  ok: true,
  messages: data.whatsappMessages.filter((message) => message.lead_id === Number(req.params.lead_id)),
}));
router.get('/whatsapp/status', (_req, res) => res.json({ ok: true, connected: false, status: 'demo_mock', demo: true }));
router.post('/whatsapp/disconnect', (_req, res) => res.json({ ok: true, demo: true }));
router.get('/whatsapp/templates', (_req, res) => res.json({ ok: true, templates: [
  { id: 1, name: 'Primer contacto demo', content: 'Hola, soy del equipo LeadOps...' },
] }));
router.post('/whatsapp/templates', (_req, res) => res.json({ ok: true, id: 99, demo: true }));
router.delete('/whatsapp/templates/:id', (_req, res) => res.json({ ok: true, demo: true }));
router.post('/whatsapp/instances', (_req, res) => res.json({ ok: true, instanceId: 'demo-instance' }));
router.get('/whatsapp/instances/status', (_req, res) => res.json({ ok: true, connected: false, demo: true }));
router.get('/events', (_req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.write(`event: demo\ndata: ${JSON.stringify({ ok: true, demo: true })}\n\n`);
});

router.post('/leads/:leadId/funnel/init', (req, res) => {
  data.funnel[req.params.leadId] = data.funnel[req.params.leadId] || { lead_id: Number(req.params.leadId), current_phase: 1 };
  res.json({ ok: true, status: data.funnel[req.params.leadId] });
});
router.get('/leads/:leadId/funnel', (req, res) => res.json({
  ok: true,
  status: data.funnel[req.params.leadId] || { lead_id: Number(req.params.leadId), current_phase: 1 },
}));
router.post('/leads/:leadId/funnel/phase1/send', (_req, res) => res.json({ ok: true, demo: true }));
router.post('/leads/:leadId/funnel/phase2/update', (_req, res) => res.json({ ok: true, demo: true }));
router.post('/leads/:leadId/funnel/phase2/parse', (_req, res) => res.json({ ok: true, parsed: { needs: 'Web clara y captación local' }, demo: true }));
router.post('/leads/:leadId/funnel/phase3/generate', (_req, res) => res.json({ ok: true, prompt: 'Propuesta demo generada con mock data', demo: true }));
router.post('/leads/:leadId/funnel/phase3/send', (_req, res) => res.json({ ok: true, demo: true }));
router.post('/leads/:leadId/funnel/phase4/preview', (_req, res) => res.json({ ok: true, demo: true }));
router.post('/leads/:leadId/funnel/phase4/send', (_req, res) => res.json({ ok: true, demo: true }));
router.post('/leads/:leadId/funnel/phase/:phase/toggle', (_req, res) => res.json({ ok: true, demo: true }));

router.post('/api/admin/tools/analyze', (_req, res) => res.json({ ok: true, items: [], demo: true }));
router.get('/api/admin/tools/metadata', (_req, res) => res.json({ ok: true, metadata: [], demo: true }));
router.delete('/api/admin/tools/image/:id', (_req, res) => res.json({ ok: true, demo: true }));
router.get('/api/admin/tools/metadata/download', (_req, res) => res.json({ ok: true, demo: true }));
router.get('/api/admin/tools/image/:filename/download', (_req, res) => res.status(204).end());
router.get('/api/admin/tools/images/download-zip', (_req, res) => res.status(204).end());
router.post('/api/admin/tools/convert/webp-to-png', (_req, res) => res.json({ ok: true, files: [], demo: true }));
router.post('/api/admin/tools/convert/to-webp', (_req, res) => res.json({ ok: true, files: [], demo: true }));
router.get('/api/admin/tools/converted/:type', (_req, res) => res.json({ ok: true, files: [], demo: true }));
router.delete('/api/admin/tools/converted/:type/:filename', (_req, res) => res.json({ ok: true, demo: true }));
router.get('/api/admin/tools/converted/:type/download', (_req, res) => res.status(204).end());
router.get('/api/admin/tools/converted/:type/download-zip', (_req, res) => res.status(204).end());

module.exports = router;
