#!/usr/bin/env node

/**
 * Run only the user_id migration for places table
 * Usage: node scripts/add_user_id_to_places.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = require(path.join(__dirname, '..', 'db', 'config'));

(async () => {
  try {
    console.log('Running migration: Add user_id to places table...');
    
    const migrationFile = path.join(__dirname, '..', 'db', 'migrations', '001_add_user_id_to_places.sql');
    
    if (!fs.existsSync(migrationFile)) {
      console.error('✗ Migration file not found:', migrationFile);
      process.exit(1);
    }
    
    const sql = fs.readFileSync(migrationFile, 'utf8');
    const connection = await pool.getConnection();
    
    try {
      await connection.query(sql);
      console.log('✓ Migration executed: 001_add_user_id_to_places.sql');
      console.log('✓ Successfully added user_id column to places table');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060) {
        console.log('⊘ Migration already applied: user_id column already exists');
      } else {
        throw err;
      }
    } finally {
      connection.release();
    }
    
    console.log('Done!');
    process.exit(0);
  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  }
})();
