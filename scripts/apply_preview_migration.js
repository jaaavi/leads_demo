#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = require(path.join(__dirname, '..', 'db', 'config'));
const mysqlConfig = require(path.join(__dirname, '..', 'db', 'mysqldata'));

(async () => {
  let conn;
  try {
    conn = await pool.getConnection();

    // Check if column already exists
    const [cols] = await conn.execute(
      `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [mysqlConfig.database, 'leads', 'preview_delivery_date']
    );

    if (cols && cols[0] && cols[0].cnt > 0) {
      console.log("La columna 'preview_delivery_date' ya existe en la tabla 'leads'. Nada que hacer.");
      process.exit(0);
    }

    // Read migration SQL file
    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '006_add_preview_delivery_date.sql');
    if (!fs.existsSync(migrationPath)) {
      console.error('Migration file no encontrada:', migrationPath);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log('Ejecutando migración:', migrationPath);

    try {
      await conn.query(sql);
      console.log('✓ Migración aplicada correctamente.');
      process.exit(0);
    } catch (err) {
      // Handle duplicate column or similar
      if (err && (err.code === 'ER_DUP_FIELDNAME' || (err.errno && err.errno === 1060))) {
        console.log("La columna ya existe (error ER_DUP_FIELDNAME). Posiblemente la migración ya fue aplicada.");
        process.exit(0);
      }
      console.error('Error aplicando migración:', err.message || err);
      process.exit(1);
    }
  } catch (e) {
    console.error('Error al ejecutar la migración:', e.message || e);
    process.exit(1);
  } finally {
    try { if (conn) conn.release(); } catch (e) { }
  }
})();
