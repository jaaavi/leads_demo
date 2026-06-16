const { createLocation, listLocations } = require('../models/locationModel');

async function postLocation(req, res) {
  try {
    const { name, latitude, longitude, source } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const id = await createLocation({ name: String(name).trim(), latitude: latitude || null, longitude: longitude || null, source: source || 'manual' });
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function getLocations(req, res) {
  try {
    const rows = await listLocations();
    res.json({ data: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = { postLocation, getLocations };
