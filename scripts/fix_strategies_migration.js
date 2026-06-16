#!/usr/bin/env node

/**
 * Direct fix for strategies table - adds user_id column
 * Usage: node scripts/fix_strategies_migration.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = require(path.join(__dirname, '..', 'db', 'config'));

(async () => {
  let connection;
  try {
    console.log('Attempting to add user_id column to strategies table...\n');
    
    connection = await pool.getConnection();

    // Step 1: Check if column already exists
    console.log('Step 1: Checking if user_id column exists...');
    try {
      const [result] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'strategies' 
        AND COLUMN_NAME = 'user_id'
      `);
      
      if (result.length > 0) {
        console.log('✓ Column user_id already exists');
      } else {
        console.log('⊘ Column user_id does not exist, adding it...');
        
        // Step 2: Add the column
        console.log('\nStep 2: Adding user_id column...');
        await connection.query(`ALTER TABLE strategies ADD COLUMN user_id INT DEFAULT NULL`);
        console.log('✓ Column user_id added successfully');
      }
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060) {
        console.log('✓ Column user_id already exists');
      } else {
        throw err;
      }
    }

    // Step 3: Create index if it doesn't exist
    console.log('\nStep 3: Creating indexes...');
    try {
      const [indexes] = await connection.query(`
        SELECT INDEX_NAME 
        FROM INFORMATION_SCHEMA.STATISTICS 
        WHERE TABLE_NAME = 'strategies' 
        AND INDEX_NAME IN ('idx_user_id', 'idx_user_active')
      `);
      
      const existingIndexes = indexes.map(i => i.INDEX_NAME);
      
      if (!existingIndexes.includes('idx_user_id')) {
        console.log('Creating index idx_user_id...');
        await connection.query(`CREATE INDEX idx_user_id ON strategies(user_id)`);
        console.log('✓ Index idx_user_id created');
      } else {
        console.log('✓ Index idx_user_id already exists');
      }
      
      if (!existingIndexes.includes('idx_user_active')) {
        console.log('Creating index idx_user_active...');
        await connection.query(`CREATE INDEX idx_user_active ON strategies(user_id, is_active)`);
        console.log('✓ Index idx_user_active created');
      } else {
        console.log('✓ Index idx_user_active already exists');
      }
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME' || err.errno === 1061) {
        console.log('✓ Indexes already exist');
      } else {
        console.log('⚠ Warning creating indexes (may already exist):', err.message);
      }
    }

    console.log('\n✓ Migration completed successfully!');
    console.log('\nYou can now access /api/admin/strategies without errors.');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Error:', err.message);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
  }
})();
