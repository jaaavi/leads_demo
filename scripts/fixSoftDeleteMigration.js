#!/usr/bin/env node

/**
 * Script to apply the soft delete migration
 * Adds deleted_at columns to leads and places tables
 * 
 * Usage: node scripts/fixSoftDeleteMigration.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = require(path.join(__dirname, '..', 'db', 'config'));

async function applyMigration() {
  let conn;
  try {
    console.log('Starting soft delete migration...\n');
    conn = await pool.getConnection();

    // Check if deleted_at already exists in leads table
    const [leadsColumns] = await conn.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'leads' AND COLUMN_NAME = 'deleted_at'"
    );

    if (leadsColumns.length === 0) {
      console.log('Adding deleted_at column to leads table...');
      await conn.query('ALTER TABLE leads ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL');
      console.log('✓ deleted_at column added to leads');
    } else {
      console.log('✓ deleted_at column already exists in leads');
    }

    // Check if index exists for leads
    const [leadsIndex] = await conn.query(
      "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_NAME = 'leads' AND INDEX_NAME = 'idx_leads_deleted_at'"
    );

    if (leadsIndex.length === 0) {
      console.log('Creating index on leads.deleted_at...');
      await conn.query('CREATE INDEX idx_leads_deleted_at ON leads(deleted_at)');
      console.log('✓ Index created for leads.deleted_at');
    } else {
      console.log('✓ Index already exists for leads.deleted_at');
    }

    // Check if deleted_at already exists in places table
    const [placesColumns] = await conn.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'places' AND COLUMN_NAME = 'deleted_at'"
    );

    if (placesColumns.length === 0) {
      console.log('\nAdding deleted_at column to places table...');
      await conn.query('ALTER TABLE places ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL');
      console.log('✓ deleted_at column added to places');
    } else {
      console.log('\n✓ deleted_at column already exists in places');
    }

    // Check if index exists for places
    const [placesIndex] = await conn.query(
      "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_NAME = 'places' AND INDEX_NAME = 'idx_places_deleted_at'"
    );

    if (placesIndex.length === 0) {
      console.log('Creating index on places.deleted_at...');
      await conn.query('CREATE INDEX idx_places_deleted_at ON places(deleted_at)');
      console.log('✓ Index created for places.deleted_at');
    } else {
      console.log('✓ Index already exists for places.deleted_at');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✓ Soft delete migration completed successfully!');
    console.log('='.repeat(60));
    console.log('Leads and places tables are now ready for soft deletes.');
    console.log('Deleted records will have a timestamp in deleted_at.');

    process.exit(0);
  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    if (error.code === 'ER_DUP_FIELDNAME' || error.errno === 1060) {
      console.log('(Column already exists - this is fine)');
      process.exit(0);
    }
    process.exit(1);
  } finally {
    if (conn) conn.release();
  }
}

applyMigration();
