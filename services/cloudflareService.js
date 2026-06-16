const axios = require('axios');

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';
const DOMAIN = process.env.CF_DOMAIN || 'demo-leads.example';
const DEFAULT_A_IP = process.env.CF_DEFAULT_A_IP || '192.0.2.10';
const DEFAULT_PROXIED = false; // DNS only
const DEFAULT_TTL = 1; // auto

let cachedZoneId = null;

function getAxios() {
  const token = process.env.CF_API_TOKEN;
  if (!token) throw new Error('CF_API_TOKEN not set');
  const instance = axios.create({
    baseURL: CF_API_BASE,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    timeout: 20000,
  });
  return instance;
}

async function getZoneId(domain = DOMAIN) {
  if (cachedZoneId) return cachedZoneId;
  const api = getAxios();
  const res = await api.get('/zones', { params: { name: domain, status: 'active' } });
  const zone = (res.data && res.data.result && res.data.result[0]) ? res.data.result[0] : null;
  if (!zone) throw new Error(`Zone not found for domain ${domain}`);
  cachedZoneId = zone.id;
  return cachedZoneId;
}

function normalizeSubdomain(name) {
  return String(name || '')
    .trim()
    .replace(/^\./, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

async function ensureARecord(subdomain, opts = {}) {
  const api = getAxios();
  const zoneId = await getZoneId();
  const name = normalizeSubdomain(subdomain);
  if (!name) throw new Error('Subdominio requerido');
  const fullName = `${name}.${DOMAIN}`;

  const content = opts.content || DEFAULT_A_IP;
  const proxied = typeof opts.proxied === 'boolean' ? opts.proxied : DEFAULT_PROXIED;
  const ttl = typeof opts.ttl === 'number' ? opts.ttl : DEFAULT_TTL;

  // Check existing
  const existing = await api.get(`/zones/${zoneId}/dns_records`, { params: { type: 'A', name: fullName } });
  const current = existing.data?.result?.[0] || null;
  if (current) {
    // Update to ensure desired state
    const updateRes = await api.put(`/zones/${zoneId}/dns_records/${current.id}`, {
      type: 'A', name: fullName, content, proxied, ttl,
    });
    return updateRes.data?.result || { id: current.id, name: fullName, content, proxied, ttl };
  }

  // Create new
  const res = await api.post(`/zones/${zoneId}/dns_records`, {
    type: 'A', name: fullName, content, proxied, ttl,
  });
  return res.data?.result || null;
}

async function listARecords(prefix = '') {
  const api = getAxios();
  const zoneId = await getZoneId();
  const params = { type: 'A', per_page: 100 }; // CF default pagination
  if (prefix) params.name = `${prefix}.${DOMAIN}`;
  const res = await api.get(`/zones/${zoneId}/dns_records`, { params });
  const items = res.data?.result || [];
  // Only subdomains (exclude root A if any)
  return items.filter(r => r.name && r.name !== DOMAIN);
}

module.exports = {
  getZoneId,
  ensureARecord,
  listARecords,
  DOMAIN,
};
