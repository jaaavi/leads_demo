const pool = require('../db/localdata');

async function createJob({ lugar, variationsTotal = 0, meta = null, userId = null }) {
  const [res] = await pool.execute(
    'INSERT INTO jobs (lugar, variations_total, processed, status, meta, user_id) VALUES (?, ?, 0, ?, ?, ?)',
    [lugar, variationsTotal, 'queued', meta ? JSON.stringify(meta) : null, userId]
  );
  return res.insertId;
}

async function updateJobProgress(id, { processed, status, finishedAt, meta }) {
  const fields = [];
  const params = [];
  if (processed !== undefined) { fields.push('processed = ?'); params.push(processed); }
  if (status) { fields.push('status = ?'); params.push(status); }
  if (finishedAt) { fields.push('finished_at = ?'); params.push(finishedAt); }
  if (meta !== undefined) { fields.push('meta = ?'); params.push(JSON.stringify(meta)); }
  if (!fields.length) return false;
  params.push(id);
  const [res] = await pool.execute(`UPDATE jobs SET ${fields.join(', ')} WHERE id = ?`, params);
  return res.affectedRows > 0;
}

async function getJobs(userId = null, userRole = 'admin') {
  let query = 'SELECT * FROM jobs';
  const params = [];

  // For non-admin users, only show their own jobs
  if (userRole !== 'admin' && userId) {
    query += ' WHERE user_id = ?';
    params.push(userId);
  }

  query += ' ORDER BY created_at DESC LIMIT 200';

  const [rows] = await pool.execute(query, params);
  return rows;
}

module.exports = { createJob, updateJobProgress, getJobs };
