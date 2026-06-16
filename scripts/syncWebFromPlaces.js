#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = require(path.join(__dirname, '..', 'db', 'config'));

async function syncWebFromPlaces() {
  try {
    console.log('Starting web field sync from places to leads...');

    const conn = await pool.getConnection();
    try {
      const [result] = await conn.execute(`
        UPDATE leads l
        JOIN places p ON l.id = p.lead_id
        SET l.web = p.web
        WHERE p.web IS NOT NULL AND p.web <> ''
        AND (l.web IS NULL OR l.web = '')
        AND l.deleted_at IS NULL
        AND p.deleted_at IS NULL
      `);

      console.log(`✓ Sync completed successfully`);
      console.log(`  Rows affected: ${result.affectedRows}`);
      console.log(`  Changed records: ${result.changedRows}`);
    } finally {
      conn.release();
    }

    process.exit(0);
  } catch (err) {
    console.error('✗ Error during sync:', err.message);
    process.exit(1);
  }
}

syncWebFromPlaces();
