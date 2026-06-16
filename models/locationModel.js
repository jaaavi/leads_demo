const pool = require('../db/localdata');

async function createLocation({ name, latitude = null, longitude = null, source = 'manual' }) {
  const [res] = await pool.execute(
    'INSERT INTO saved_locations (name, latitude, longitude, source) VALUES (?, ?, ?, ?)',
    [name, latitude, longitude, source]
  );
  return res.insertId;
}

async function listLocations() {
  const [rows] = await pool.execute('SELECT * FROM saved_locations ORDER BY created_at DESC');
  return rows;
}

module.exports = { createLocation, listLocations };
