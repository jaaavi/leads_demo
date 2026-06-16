const fs = require('fs');
const path = require('path');
const pool = require('./config');

async function runMigrations() {
  try {
    const migrationsDir = path.join(__dirname, 'migrations');

    if (!fs.existsSync(migrationsDir)) {
      console.log('Migrations directory does not exist');
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf8');

      // Split statements by semicolon and filter out empty lines
      const statements = sqlContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      try {
        const connection = await pool.getConnection();
        try {
          // Execute each statement individually
          for (const statement of statements) {
            await connection.query(statement);
          }
          console.log(`✓ Migration executed: ${file}`);
        } finally {
          connection.release();
        }
      } catch (err) {
        // Ignore errors that indicate migration was already applied
        if (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060) {
          console.log(`⊘ Migration already applied: ${file} (column already exists)`);
        } else if (err.code === 'ER_DUP_KEYNAME' || err.errno === 1061 || err.code === 'ER_KEY_COLUMN_DOES_NOT_EXITS' || err.errno === 1072) {
          console.log(`⊘ Migration already applied: ${file} (index or constraint already exists)`);
        } else {
          console.error(`✗ Migration failed: ${file}`);
          throw err;
        }
      }
    }
  } catch (err) {
    console.error('Error running migrations:', err);
    throw err;
  }
}

module.exports = { runMigrations };
