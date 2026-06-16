const { ensureARecord, listARecords, DOMAIN } = require('../services/cloudflareService');

async function getSubdomainsPage(req, res) {
  return res.render('admin/subdomains', { session: req.session, domain: DOMAIN });
}

async function listSubdomains(req, res) {
  try {
    const q = (req.query.q || '').trim();
    const records = await listARecords(q);
    res.json({ ok: true, records });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

async function createSubdomain(req, res) {
  try {
    const { subdomain } = req.body || {};
    if (!subdomain) return res.status(400).json({ ok: false, error: 'subdomain requerido' });
    const record = await ensureARecord(subdomain, {});
    res.json({ ok: true, record });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

module.exports = { getSubdomainsPage, listSubdomains, createSubdomain };
