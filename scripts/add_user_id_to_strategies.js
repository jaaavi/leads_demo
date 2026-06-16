#!/usr/bin/env node

/**
 * Run only the user_id migration for strategies table
 * Usage: node scripts/add_user_id_to_strategies.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = require(path.join(__dirname, '..', 'db', 'config'));

(async () => {
  try {
    console.log('Running migration: Add user_id to strategies table...');
    
    const migrationFile = path.join(__dirname, '..', 'db', 'migrations', '001_add_user_id_to_strategies.sql');
    
    if (!fs.existsSync(migrationFile)) {
      console.error('✗ Migration file not found:', migrationFile);
      process.exit(1);
    }
    
    const sqlContent = fs.readFileSync(migrationFile, 'utf8');
    const connection = await pool.getConnection();

    try {
      // Split statements by semicolon and filter out empty lines and comments
      const statements = sqlContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      // Execute each statement individually
      for (const statement of statements) {
        await connection.query(statement);
      }

      console.log('✓ Migration executed: 001_add_user_id_to_strategies.sql');
      console.log('✓ Successfully added user_id column to strategies table');
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
