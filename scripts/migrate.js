#!/usr/bin/env node

/**
 * Database Migration Script
 * Run this manually if migrations don't execute automatically:
 * node scripts/migrate.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { runMigrations } = require(path.join(__dirname, '..', 'db', 'migrations'));

(async () => {
  try {
    console.log('Running database migrations...');
    await runMigrations();
    console.log('All migrations completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
})();
