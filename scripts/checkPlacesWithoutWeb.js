#!/usr/bin/env node

/**
 * Script to check places without web
 * Usage: node scripts/checkPlacesWithoutWeb.js
 *
 * This script analyzes the places table to find records that have no web URL.
 * It provides statistics on how many places lack web information.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = require('../db/config');

async function checkPlacesWithoutWeb() {
  try {
    console.log('\n📊 PLACES WITHOUT WEB - ANALYSIS REPORT\n');
    console.log('='.repeat(60));

    // 1. Count of places WITHOUT web
    const [countRows] = await pool.execute(`
      SELECT COUNT(*) as total_places_without_web
      FROM places
      WHERE web IS NULL OR web = ''
    `);
    const totalWithoutWeb = countRows[0].total_places_without_web;
    console.log(`\n1️⃣  Places WITHOUT web (NULL or empty): ${totalWithoutWeb}`);

    // 2. Percentage of places without web
    const [percentRows] = await pool.execute(`
      SELECT 
        ROUND((COUNT(*) * 100.0) / (SELECT COUNT(*) FROM places), 2) as percentage_without_web
      FROM places
      WHERE web IS NULL OR web = ''
    `);
    const percentageWithoutWeb = percentRows[0].percentage_without_web || 0;
    console.log(`   Percentage: ${percentageWithoutWeb}%`);

    // 3. Breakdown by status
    console.log(`\n2️⃣  Breakdown by web status:`);
    const [statusRows] = await pool.execute(`
      SELECT 
        CASE 
          WHEN web IS NULL THEN 'NULL'
          WHEN web = '' THEN 'Empty String'
          ELSE 'Has Web'
        END as web_status,
        COUNT(*) as count,
        ROUND((COUNT(*) * 100.0) / (SELECT COUNT(*) FROM places), 2) as percentage
      FROM places
      GROUP BY web_status
      ORDER BY count DESC
    `);
    statusRows.forEach(row => {
      console.log(`   • ${row.web_status}: ${row.count} (${row.percentage}%)`);
    });

    // 4. Sample of places without web
    console.log(`\n3️⃣  Sample of places without web (first 10):`);
    const [sampleRows] = await pool.execute(`
      SELECT 
        id,
        name,
        main_category,
        city,
        phone,
        created_at
      FROM places
      WHERE web IS NULL OR web = ''
      ORDER BY created_at DESC
      LIMIT 10
    `);
    if (sampleRows.length === 0) {
      console.log('   ✅ No places without web found!');
    } else {
      sampleRows.forEach((row, index) => {
        console.log(`
   ${index + 1}. ID: ${row.id}
      Name: ${row.name}
      Category: ${row.main_category || 'N/A'}
      City: ${row.city || 'N/A'}
      Phone: ${row.phone || 'N/A'}
      Created: ${row.created_at}`);
      });
    }

    // 5. Count by category
    console.log(`\n4️⃣  Places without web by category (top 10):`);
    const [categoryRows] = await pool.execute(`
      SELECT 
        COALESCE(main_category, 'No Category') as category,
        COUNT(*) as count_without_web
      FROM places
      WHERE web IS NULL OR web = ''
      GROUP BY main_category
      ORDER BY count_without_web DESC
      LIMIT 10
    `);
    categoryRows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.category}: ${row.count_without_web}`);
    });

    // 6. Count by city
    console.log(`\n5️⃣  Places without web by city (top 10):`);
    const [cityRows] = await pool.execute(`
      SELECT 
        COALESCE(city, 'No City') as city,
        COUNT(*) as count_without_web
      FROM places
      WHERE web IS NULL OR web = ''
      GROUP BY city
      ORDER BY count_without_web DESC
      LIMIT 10
    `);
    cityRows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.city}: ${row.count_without_web}`);
    });

    // 7. Total statistics
    console.log(`\n6️⃣  Overall Statistics:`);
    const [statsRows] = await pool.execute(`
      SELECT 
        (SELECT COUNT(*) FROM places) as total_places,
        (SELECT COUNT(*) FROM places WHERE web IS NOT NULL AND web <> '') as places_with_web,
        (SELECT COUNT(*) FROM places WHERE web IS NULL OR web = '') as places_without_web
    `);
    const stats = statsRows[0];
    const percentWithWeb = stats.total_places > 0 
      ? Math.round((stats.places_with_web * 100) / stats.total_places * 100) / 100
      : 0;
    const percentWithoutWeb = stats.total_places > 0
      ? Math.round((stats.places_without_web * 100) / stats.total_places * 100) / 100
      : 0;

    console.log(`   Total places: ${stats.total_places}`);
    console.log(`   With web: ${stats.places_with_web} (${percentWithWeb}%)`);
    console.log(`   Without web: ${stats.places_without_web} (${percentWithoutWeb}%)`);

    console.log(`\n${'='.repeat(60)}\n`);

    if (totalWithoutWeb > 0) {
      console.log(`✅ Found ${totalWithoutWeb} places without web. See details above.`);
    } else {
      console.log(`✅ All places have web information!`);
    }

    console.log('');

  } catch (error) {
    console.error('❌ Error analyzing places:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the check
checkPlacesWithoutWeb();
