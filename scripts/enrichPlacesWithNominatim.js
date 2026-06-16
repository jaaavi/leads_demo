#!/usr/bin/env node

/**
 * Script to enrich existing places with Nominatim geocoding data
 * Adds city and neighborhood (barrio) information to places
 * 
 * Usage: node scripts/enrichPlacesWithNominatim.js
 */

const fs = require('fs');
const path = require('path');

// Load .env from project root only if DB env vars are not already provided and .env exists
const envPath = path.join(__dirname, '..', '.env');
if (!process.env.MYSQL_HOST && fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

// Prefer using central db/config (production server pool) if available, otherwise fallback to localdata pool
let pool;
try {
  // db/config will attempt a connection test; use it on servers where it's configured
  pool = require('../db/config');
} catch (e) {
  pool = require('../db/localdata');
}

const { enrichAddressWithRateLimit } = require('../services/nominatimService');

const BATCH_SIZE = 50; // Process in batches to avoid overwhelming the API
const DELAY_BETWEEN_BATCHES = 0; // Per-request rate limiting is enforced; no extra batch delay needed

/**
 * Delay execution for a given number of milliseconds
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process a batch of places to enrich them with Nominatim data
 */
async function processBatch(places) {
  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
  };

  for (const place of places) {
    // Skip if no enrichment needed
    if (!place.street_address || !place.country_code) {
      results.skipped += 1;
      continue;
    }

    try {
      // Ensure we query Nominatim with street + city (do not use name or fallbacks)
      if (!place.city) {
        console.log(`→ ID ${place.id}: ${place.name} - Skipped because city is missing`);
        results.skipped += 1;
        continue;
      }

      const enrichedData = await enrichAddressWithRateLimit(
        place.street_address,
        place.city,
        place.country_code,
        place.state
      );

      if (enrichedData) {
        const city = enrichedData.city || place.city;
        const barrio = enrichedData.barrio || null;

        // Update the place with enriched data
        await pool.execute(
          'UPDATE places SET city = ?, barrio = ? WHERE id = ?',
          [city, barrio, place.id]
        );

        results.success += 1;
        console.log(`✓ ID ${place.id}: ${place.name} - City: ${city}, Barrio: ${barrio || 'N/A'}`);
      } else {
        results.failed += 1;
        console.log(`✗ ID ${place.id}: ${place.name} - Nominatim returned no results`);
      }
    } catch (error) {
      results.failed += 1;
      console.error(`✗ ID ${place.id}: ${place.name} - Error: ${error.message}`);
    }

    // Per-request rate limiting is applied inside the service
  }

  return results;
}

/**
 * Main function to enrich all places
 */
async function enrichAllPlaces() {
  let totalProcessed = 0;
  let totalSuccess = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let page = 0;

  console.log('Starting enrichment of places with Nominatim data...\n');

  try {
    let hasMore = true;

    while (hasMore) {
      const offset = page * BATCH_SIZE;

      // Fetch a batch of places that need enrichment (excluding soft-deleted places)
      const [places] = await pool.execute(
        'SELECT id, name, street_address, city, state, country_code FROM places WHERE street_address IS NOT NULL AND country_code IS NOT NULL AND deleted_at IS NULL ORDER BY id LIMIT ? OFFSET ?',
        [BATCH_SIZE, offset]
      );

      if (places.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`\nProcessing batch ${page + 1} (${places.length} places)...`);
      const batchResults = await processBatch(places);

      totalProcessed += places.length;
      totalSuccess += batchResults.success;
      totalFailed += batchResults.failed;
      totalSkipped += batchResults.skipped;

      page += 1;

      // Delay between batches to respect Nominatim rate limits
      if (places.length === BATCH_SIZE) {
        console.log(`Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
        await sleep(DELAY_BETWEEN_BATCHES);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Enrichment completed!');
    console.log('='.repeat(60));
    console.log(`Total processed: ${totalProcessed}`);
    console.log(`Successfully enriched: ${totalSuccess}`);
    console.log(`Failed: ${totalFailed}`);
    console.log(`Skipped (insufficient data): ${totalSkipped}`);
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('Fatal error during enrichment:', error);
    process.exit(1);
  }
}

// Run the enrichment
enrichAllPlaces();
