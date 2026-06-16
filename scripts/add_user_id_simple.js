#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = require(path.join(__dirname, '..', 'db', 'config'));

(async () => {
  let connection;
  try {
    console.log('Adding user_id column to strategies table...\n');
    
    connection = await pool.getConnection();

    // Execute ALTER TABLE directly
    console.log('Executing: ALTER TABLE strategies ADD COLUMN user_id INT DEFAULT NULL;');
    await connection.query('ALTER TABLE strategies ADD COLUMN user_id INT DEFAULT NULL');
    console.log('✓ Column added\n');

    // Create index 1
    console.log('Executing: CREATE INDEX idx_user_id ON strategies(user_id);');
    try {
      await connection.query('CREATE INDEX idx_user_id ON strategies(user_id)');
      console.log('✓ Index idx_user_id created\n');
    } catch (e) {
      console.log('⚠ Index idx_user_id: ' + e.message + '\n');
    }

    // Create index 2
    console.log('Executing: CREATE INDEX idx_user_active ON strategies(user_id, is_active);');
    try {
      await connection.query('CREATE INDEX idx_user_active ON strategies(user_id, is_active)');
      console.log('✓ Index idx_user_active created\n');
    } catch (e) {
      console.log('⚠ Index idx_user_active: ' + e.message + '\n');
    }

    // Verify the column was created
    console.log('Verifying column...');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'strategies' AND COLUMN_NAME = 'user_id'
    `);

    if (columns.length > 0) {
      const col = columns[0];
      console.log('✓ Column user_id exists:');
      console.log(`  Type: ${col.COLUMN_TYPE}`);
      console.log(`  Nullable: ${col.IS_NULLABLE}`);
      console.log(`  Default: ${col.COLUMN_DEFAULT}`);
      console.log('\n✓ Migration completed successfully!');
    } else {
      console.log('✗ Column user_id was not created');
      process.exit(1);
    }

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
