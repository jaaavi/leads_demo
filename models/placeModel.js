const pool = require('../db/localdata');
const { extractMainCategory } = require('../utils/categoryMapper');
const { shouldExcludePlace } = require('../utils/excludedCategoriesAndDomains');
const { isSocialMedia } = require('../utils/socialMediaDetector');
const { deduplicatePlacesList, normalizePhone, normalizeUrl, normalizeName } = require('../utils/deduplicationHelper');



async function upsertPlace(conn, place, sourceQuery, userId = null, jobId = null) {
  const { name: rawName, category, tags, notes, placeId, phone, phone_type, web, address, coordinates } = place;
  const name = rawName && String(rawName).trim() ? String(rawName).trim() : null;

  // Skip records without a valid name because DB requires name NOT NULL
  if (!name) return null;

  // Skip records with excluded categories or domains
  if (shouldExcludePlace(place)) {
    return null;
  }

  const lat = coordinates?.lat ?? null;
  const lng = coordinates?.long ?? null;
  const street = address?.street_address ?? null;
  let city = address?.city ?? null;
  const zip = address?.zip ?? null;
  const state = address?.state ?? null;
  const country = address?.country_code ?? null;

  // Barrio is taken as-is from the input data (no API enrichment)
  let barrio = address?.barrio ?? null;

  // Extract main category and raw categories
  const { main: mainCategory, raw: rawCategories } = extractMainCategory(category);

  // If we have a place_id (Google Place ID) rely on unique constraint to upsert
  if (placeId) {
    const [result] = await conn.execute(
      `INSERT INTO places (
        name, main_category, raw_categories, tags, notes, place_id, phone, phone_type, web,
        street_address, city, barrio, zip, state, country_code, latitude, longitude, source_query, user_id, job_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name=VALUES(name),
        main_category=VALUES(main_category),
        raw_categories=VALUES(raw_categories),
        tags=VALUES(tags),
        notes=VALUES(notes),
        phone=VALUES(phone),
        phone_type=VALUES(phone_type),
        web=VALUES(web),
        street_address=VALUES(street_address),
        city=VALUES(city),
        barrio=VALUES(barrio),
        zip=VALUES(zip),
        state=VALUES(state),
        country_code=VALUES(country_code),
        latitude=VALUES(latitude),
        longitude=VALUES(longitude),
        source_query=VALUES(source_query),
        place_id=VALUES(place_id),
        user_id=COALESCE(VALUES(user_id), user_id),
        job_id=COALESCE(VALUES(job_id), job_id),
        id=LAST_INSERT_ID(id)`,
      [
        name,
        mainCategory || null,
        rawCategories || null,
        tags || null,
        notes || null,
        placeId || null,
        phone || null,
        phone_type || null,
        web || null,
        street,
        city,
        barrio,
        zip,
        state,
        country,
        lat,
        lng,
        sourceQuery || null,
        userId || null,
        jobId || null,
      ]
    );

    const wasInserted = result.affectedRows === 1;
    const id = result.insertId;
    return { id, inserted: !!wasInserted };
  }

  // If there is no place_id, try to find an existing place by a combination of reliable fields
  // Prefer matching by normalized phone, then by normalized web, then by normalized name+city
  // Skip deleted places to avoid re-merging with soft-deleted records

  // Check by normalized phone (exact match after normalization)
  if (phone) {
    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone) {
      const [rows] = await conn.execute(
        'SELECT id FROM places WHERE REGEXP_LIKE(phone, ?) AND deleted_at IS NULL LIMIT 1',
        [normalizedPhone.replace(/[+]/g, '\\+')]
      );
      if (rows.length) {
        const id = rows[0].id;
        await conn.execute(
          `UPDATE places SET name = ?, main_category = ?, raw_categories = ?, tags = ?, notes = ?, phone = ?, phone_type = ?, web = ?, street_address = ?, city = ?, barrio = ?, zip = ?, state = ?, country_code = ?, latitude = ?, longitude = ?, source_query = ?, user_id = COALESCE(?, user_id), job_id = COALESCE(?, job_id), deleted_at = NULL WHERE id = ?`,
          [name, mainCategory || null, rawCategories || null, tags || null, notes || null, phone || null, phone_type || null, web || null, street, city, barrio, zip, state, country, lat, lng, sourceQuery || null, userId || null, jobId || null, id]
        );
        return { id, inserted: false };
      }
    }
  }

  // Check by normalized web URL
  if (web) {
    const normalizedWeb = normalizeUrl(web);
    if (normalizedWeb) {
      // Search for URLs with the same normalized domain (skip deleted places)
      const [rows] = await conn.execute(
        `SELECT id FROM places WHERE web IS NOT NULL AND deleted_at IS NULL AND LOWER(TRIM(BOTH '/' FROM REPLACE(REPLACE(web, 'https://', ''), 'http://', ''))) LIKE ?`,
        [`%${normalizedWeb}%`]
      );
      if (rows.length) {
        const id = rows[0].id;
        await conn.execute(
          `UPDATE places SET name = ?, main_category = ?, raw_categories = ?, tags = ?, notes = ?, phone = ?, phone_type = ?, web = ?, street_address = ?, city = ?, barrio = ?, zip = ?, state = ?, country_code = ?, latitude = ?, longitude = ?, source_query = ?, user_id = COALESCE(?, user_id), job_id = COALESCE(?, job_id), deleted_at = NULL WHERE id = ?`,
          [name, mainCategory || null, rawCategories || null, tags || null, notes || null, phone || null, phone_type || null, web || null, street, city, barrio, zip, state, country, lat, lng, sourceQuery || null, userId || null, jobId || null, id]
        );
        return { id, inserted: false };
      }
    }
  }

  // Fallback: try by normalized name + city (skip deleted places)
  if (city) {
    const normalizedName = normalizeName(name);
    const [rows] = await conn.execute(
      `SELECT id FROM places WHERE city = ? AND deleted_at IS NULL AND LOWER(TRIM(CONCAT(name, ''))) LIKE ? LIMIT 1`,
      [city, `%${normalizedName}%`]
    );
    if (rows.length) {
      const id = rows[0].id;
      await conn.execute(
        `UPDATE places SET name = ?, main_category = ?, raw_categories = ?, tags = ?, notes = ?, phone = ?, phone_type = ?, web = ?, street_address = ?, city = ?, barrio = ?, zip = ?, state = ?, country_code = ?, latitude = ?, longitude = ?, source_query = ?, user_id = COALESCE(?, user_id), job_id = COALESCE(?, job_id), deleted_at = NULL WHERE id = ?`,
        [name, mainCategory || null, rawCategories || null, tags || null, notes || null, phone || null, phone_type || null, web || null, street, city, barrio, zip, state, country, lat, lng, sourceQuery || null, userId || null, jobId || null, id]
      );
      return { id, inserted: false };
    }
  }

  // If no match, insert a new place (place_id will be NULL)
  const [res] = await conn.execute(
    `INSERT INTO places (name, main_category, raw_categories, tags, notes, place_id, phone, phone_type, web, street_address, city, barrio, zip, state, country_code, latitude, longitude, source_query, user_id, job_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, mainCategory || null, rawCategories || null, tags || null, notes || null, null, phone || null, phone_type || null, web || null, street, city, barrio, zip, state, country, lat, lng, sourceQuery || null, userId || null, jobId || null]
  );
  return { id: res.insertId, inserted: true };
}

async function replaceTags(conn, placeDbId, tags) {
  await conn.execute('DELETE FROM place_tags WHERE place_id = ?', [placeDbId]);
  if (!tags) return;
  const list = String(tags)
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  for (const tag of list) {
    await conn.execute('INSERT INTO place_tags (place_id, tag) VALUES (?, ?)', [placeDbId, tag]);
  }
}

async function bulkUpsertPlaces(listResults, sourceQuery, userId = null, jobId = null) {
  if (!Array.isArray(listResults)) return { inserted: 0, updated: 0, total: 0, duplicatesRemoved: 0 };

  // Step 1: Deduplicate within the batch
  const { places: deduplicatedPlaces, removedCount: batchDuplicates } = deduplicatePlacesList(listResults);
  console.log(`[bulkUpsertPlaces] Processing ${deduplicatedPlaces.length} places (removed ${batchDuplicates} duplicates from batch)`);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let total = 0;
    let inserted = 0;
    let updated = 0;
    for (const place of deduplicatedPlaces) {
      const res = await upsertPlace(conn, place, sourceQuery, userId, jobId);
      if (!res) {
        continue;
      }
      const { id, inserted: wasInserted } = res;
      await replaceTags(conn, id, place.tags);
      total += 1;
      if (wasInserted) inserted += 1; else updated += 1;
    }
    await conn.commit();
    return { inserted, updated, total, duplicatesRemoved: batchDuplicates };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function listPlaces({ page = 1, pageSize = 20, mainCategory, city, barrio, hasWeb, hasPhone, q, tag, excludeConverted = true, phoneType, userId = null, jobId = null }) {
  const offset = (page - 1) * pageSize;
  const where = [];
  const params = [];

  // Exclude soft-deleted places
  where.push('deleted_at IS NULL');

  // Exclude places already converted to leads by default
  if (excludeConverted) { where.push('lead_id IS NULL'); }

  // Exclude places with excluded categories
  const { EXCLUDED_CATEGORIES, EXCLUDED_DOMAINS } = require('../utils/excludedCategoriesAndDomains');
  const excludedCategoriesConditions = EXCLUDED_CATEGORIES.map(cat => `main_category NOT LIKE ?`);
  if (excludedCategoriesConditions.length > 0) {
    where.push(`(${excludedCategoriesConditions.join(' AND ')})`);
    params.push(...EXCLUDED_CATEGORIES.map(cat => `%${cat}%`));
  }

  // Exclude places with excluded domains (only for places that have a web value)
  const excludedDomainsConditions = EXCLUDED_DOMAINS.map(() => `(web IS NULL OR web = '' OR web NOT LIKE ?)`);
  if (excludedDomainsConditions.length > 0) {
    where.push(`(${excludedDomainsConditions.join(' AND ')})`);
    params.push(...EXCLUDED_DOMAINS.map(domain => `%${domain}%`));
  }

  // Filter by user if provided (for comercial_pro users to see only their own places)
  if (userId !== null) { where.push('user_id = ?'); params.push(userId); }

  // Filter by job if provided (only if column exists)
  if (jobId !== null) {
    console.log('[listPlaces] Attempting to filter by jobId:', jobId);
    try {
      const [colRows] = await pool.execute("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'places' AND COLUMN_NAME = 'job_id' LIMIT 1");
      if (Array.isArray(colRows) && colRows.length > 0) {
        console.log('[listPlaces] job_id column exists, applying filter');
        where.push('job_id = ?');
        params.push(jobId);
      } else {
        console.warn('[listPlaces] job_id column does not exist in places table');
      }
    } catch (e) {
      console.warn('[listPlaces] Could not check job_id column existence:', e.message);
    }
  }

  if (mainCategory) { where.push('main_category = ?'); params.push(mainCategory); }
  if (city) { where.push('city = ?'); params.push(city); }
  if (barrio) { where.push('barrio = ?'); params.push(barrio); }
  if (phoneType && phoneType !== 'all') {
    where.push('phone_type = ?');
    params.push(phoneType);
  }

  // Filter by web presence type
  // hasWeb values:
  //   '1' = real website only (exclude social media and null/empty)
  //   '0' = no web at all (null or empty)
  //   'social' = social media only
  //   undefined/null/'' = ALL places (with and without web) - default behavior
  if (hasWeb === '1') {
    // Real website only (will filter out social media at application level)
    where.push("web IS NOT NULL AND web <> ''");
  } else if (hasWeb === '0') {
    // No web at all (neither real web nor social media)
    where.push("(web IS NULL OR web = '')");
  } else if (hasWeb === 'social') {
    // Only social media (has web but it's a social media URL, will filter at application level)
    where.push("web IS NOT NULL AND web <> ''");
  }
  // If hasWeb is undefined/null/empty or any other value, NO web filter is applied
  // This ensures ALL places are returned, including those without web

  if (hasPhone === '1') where.push('phone IS NOT NULL AND phone <> ""');
  if (hasPhone === '0') where.push('(phone IS NULL OR phone = "")');
  if (q) { where.push('(name LIKE ? OR main_category LIKE ? OR raw_categories LIKE ? OR tags LIKE ? OR city LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  if (tag) {
    where.push('(tags LIKE ? OR EXISTS (SELECT 1 FROM place_tags pt WHERE pt.place_id = places.id AND pt.tag = ?))');
    params.push(`%${tag}%`, tag);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  console.log('[listPlaces] Final WHERE clause:', whereSql);
  console.log('[listPlaces] Parameters:', params);

  // Fetch more rows than needed to account for social media filtering AND deduplication
  // We need to fetch enough to ensure we have pageSize results after filtering and deduplication
  const fetchMultiplier = (hasWeb === '1' || hasWeb === 'social') ? 8 : 3;
  const fetchLimit = pageSize * fetchMultiplier;

  const [rows] = await pool.execute(
    `SELECT * FROM places ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(fetchLimit), Number(offset)]
  );

  // Step 1: Filter rows based on social media classification if needed
  let filteredRows = rows;
  if (hasWeb === '1') {
    // Only real websites (exclude social media)
    filteredRows = rows.filter(row => row.web && !isSocialMedia(row.web));
  } else if (hasWeb === 'social') {
    // Only social media URLs
    filteredRows = rows.filter(row => row.web && isSocialMedia(row.web));
  }

  // Step 2: Deduplicate the filtered results
  // This removes duplicates that may exist from previous scrapings
  const { places: dedupedRows, removedCount: dedupeCount } = deduplicatePlacesList(filteredRows);

  if (dedupeCount > 0) {
    console.log(`[listPlaces] Removed ${dedupeCount} duplicates from ${filteredRows.length} filtered rows`);
  }

  // Step 3: Ensure we return exactly pageSize rows or less if there aren't enough
  const pagedRows = dedupedRows.slice(0, Number(pageSize));

  // Step 4: Get total count for pagination
  // For accurate counts with filtering, we need to load and count all matching rows
  let totalCount;
  if (hasWeb === '1' || hasWeb === 'social') {
    // For social media filters, count all matching rows with their web classification
    const [allRowsForCount] = await pool.execute(
      `SELECT id, web FROM places ${whereSql}`,
      params
    );

    let countFiltered;
    if (hasWeb === '1') {
      countFiltered = allRowsForCount.filter(row => row.web && !isSocialMedia(row.web));
    } else if (hasWeb === 'social') {
      countFiltered = allRowsForCount.filter(row => row.web && isSocialMedia(row.web));
    } else {
      countFiltered = allRowsForCount;
    }

    // Count after deduplication (for accuracy in pagination UI)
    const { places: dedupedForCount } = deduplicatePlacesList(countFiltered);
    totalCount = dedupedForCount.length;
  } else {
    const [countRows] = await pool.execute(`SELECT COUNT(*) as cnt FROM places ${whereSql}`, params);
    const countBeforeDedupe = countRows[0].cnt;

    // For a more accurate count, we would need to fetch and dedupe all results
    // For now, use the pre-dedupe count as an estimate (may be slightly high)
    totalCount = countBeforeDedupe;
  }

  return { data: pagedRows, total: totalCount, page: Number(page), pageSize: Number(pageSize) };
}

async function getPlacesCities() {
  const [rows] = await pool.execute(`SELECT DISTINCT city FROM places WHERE city IS NOT NULL AND city <> '' AND deleted_at IS NULL ORDER BY city`);
  return rows.map(r => r.city);
}

async function getPlacesBarrios(userId = null) {
  const userFilter = userId !== null ? ' AND user_id = ?' : '';
  const [rows] = await pool.execute(`SELECT DISTINCT barrio FROM places WHERE barrio IS NOT NULL AND barrio <> '' AND deleted_at IS NULL${userFilter} ORDER BY barrio`, userId !== null ? [userId] : []);
  return rows.map(r => r.barrio);
}

async function getMeta(userId = null) {
  // Optional user scoping for comercial_pro users
  const userFilter = userId !== null ? ' AND user_id = ?' : '';
  const { EXCLUDED_CATEGORIES, EXCLUDED_DOMAINS } = require('../utils/excludedCategoriesAndDomains');

  // Build exclusion conditions for categories
  const excludedCategoriesConditions = EXCLUDED_CATEGORIES.map(() => `main_category NOT LIKE ?`);
  const excludedDomainsConditions = EXCLUDED_DOMAINS.map(() => `web NOT LIKE ?`);
  const exclusionWhere = [];
  const exclusionParams = [];

  if (excludedCategoriesConditions.length > 0) {
    exclusionWhere.push(`(${excludedCategoriesConditions.join(' AND ')})`);
    exclusionParams.push(...EXCLUDED_CATEGORIES.map(cat => `%${cat}%`));
  }
  if (excludedDomainsConditions.length > 0) {
    exclusionWhere.push(`(${excludedDomainsConditions.join(' AND ')})`);
    exclusionParams.push(...EXCLUDED_DOMAINS.map(domain => `%${domain}%`));
  }

  const exclusionSql = exclusionWhere.length ? ` AND ${exclusionWhere.join(' AND ')}` : '';

  // Main categories - distinct values from main_category (scoped when userId provided)
  const mainCatsParams = [...exclusionParams];
  if (userId !== null) mainCatsParams.push(userId);

  const [mainCats] = await pool.execute(
    `SELECT DISTINCT main_category FROM places WHERE main_category IS NOT NULL AND main_category <> '' AND deleted_at IS NULL${exclusionSql}${userFilter} ORDER BY main_category`,
    mainCatsParams
  );
  const mainCategories = mainCats.map(r => r.main_category).sort();

  // Tags come from normalized place_tags table. Join to places to apply user scoping and exclusions.
  const tagsParams = [...exclusionParams];
  if (userId !== null) tagsParams.push(userId);

  const [tags] = await pool.execute(
    `SELECT DISTINCT pt.tag FROM place_tags pt JOIN places p ON p.id = pt.place_id WHERE pt.tag IS NOT NULL AND pt.tag <> '' AND p.deleted_at IS NULL${exclusionSql}${userId !== null ? ' AND p.user_id = ?' : ''} ORDER BY pt.tag`,
    tagsParams
  );
  const tagList = tags.map(r => r.tag).sort();

  // Cities - distinct values from city (scoped when userId provided and with exclusions)
  const citiesParams = [...exclusionParams];
  if (userId !== null) citiesParams.push(userId);

  const [cities] = await pool.execute(
    `SELECT DISTINCT city FROM places WHERE city IS NOT NULL AND city <> '' AND deleted_at IS NULL${exclusionSql}${userFilter} ORDER BY city`,
    citiesParams
  );
  const cityList = cities.map(r => r.city);

  // Phone types - distinct values from phone_type (scoped when userId provided and with exclusions)
  const phoneTypesParams = [...exclusionParams];
  if (userId !== null) phoneTypesParams.push(userId);

  const [phoneTypes] = await pool.execute(
    `SELECT DISTINCT phone_type FROM places WHERE phone_type IS NOT NULL AND phone_type <> '' AND deleted_at IS NULL${exclusionSql}${userFilter} ORDER BY phone_type`,
    phoneTypesParams
  );
  const phoneTypeList = phoneTypes.map(r => r.phone_type);

  // Barrios (neighborhoods)
  const barrios = await getPlacesBarrios(userId);

  return { mainCategories, tags: tagList, cities: cityList, phoneTypes: phoneTypeList, barrios };
}

async function getPlaceById(id) {
  const [rows] = await pool.execute('SELECT * FROM places WHERE id = ? AND deleted_at IS NULL LIMIT 1', [id]);
  if (!rows.length) return null;
  const place = rows[0];
  const [trows] = await pool.execute('SELECT tag FROM place_tags WHERE place_id = ?', [id]);
  place.tags = trows.map(r => r.tag).join(', ');
  return place;
}

async function createPlace(data) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let { name, mainCategory, rawCategories, tags, notes, place_id, phone, phone_type, web, street_address, city, zip, state, country_code, latitude, longitude, source_query } = data;
    let barrio = data.barrio || null;

    // If old 'category' field is provided, extract main and raw
    if (data.category && !mainCategory && !rawCategories) {
      const extracted = extractMainCategory(data.category);
      mainCategory = extracted.main;
      rawCategories = extracted.raw;
    }

    // Enrich address data with Nominatim API if we have street, city, and country
    if (street_address && city && country_code) {
      try {
        const { enrichedCity, enrichedBarrio } = await enrichPlaceAddress(street_address, city, country_code, state);
        if (enrichedCity) city = enrichedCity;
        if (enrichedBarrio) barrio = enrichedBarrio;
      } catch (error) {
        console.error('Address enrichment failed in createPlace, continuing with original data:', error.message);
      }
    }

    const [res] = await conn.execute(
      `INSERT INTO places (name, main_category, raw_categories, tags, notes, place_id, phone, phone_type, web, street_address, city, barrio, zip, state, country_code, latitude, longitude, source_query) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name || null, mainCategory || null, rawCategories || null, tags || null, notes || null, place_id || null, phone || null, phone_type || null, web || null, street_address || null, city || null, barrio || null, zip || null, state || null, country_code || null, latitude || null, longitude || null, source_query || null]
    );
    const id = res.insertId;
    await replaceTags(conn, id, tags);
    await conn.commit();
    return id;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function updatePlaceById(id, data) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const fields = [];
    const params = [];
    const allowed = ['name', 'main_category', 'raw_categories', 'tags', 'notes', 'place_id', 'phone', 'phone_type', 'web', 'street_address', 'city', 'barrio', 'zip', 'state', 'country_code', 'latitude', 'longitude', 'source_query'];

    let dataToUpdate = { ...data };

    // If old 'category' field is provided, extract main and raw
    if (data.category && !data.mainCategory && !data.rawCategories) {
      const extracted = extractMainCategory(data.category);
      dataToUpdate.mainCategory = extracted.main;
      dataToUpdate.rawCategories = extracted.raw;
    }

    // Enrich address data if street_address, city, and country are being updated
    if (dataToUpdate.street_address && dataToUpdate.city && dataToUpdate.country_code) {
      try {
        const { enrichedCity, enrichedBarrio } = await enrichPlaceAddress(
          dataToUpdate.street_address,
          dataToUpdate.city,
          dataToUpdate.country_code,
          dataToUpdate.state
        );
        if (enrichedCity) dataToUpdate.city = enrichedCity;
        if (enrichedBarrio) dataToUpdate.barrio = enrichedBarrio;
      } catch (error) {
        console.error('Address enrichment failed in updatePlaceById, continuing with original data:', error.message);
      }
    }

    for (const k of allowed) {
      if (dataToUpdate[k] !== undefined) {
        fields.push(`${k} = ?`);
        params.push(dataToUpdate[k]);
      }
    }

    if (fields.length) {
      params.push(id);
      await conn.execute(`UPDATE places SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    if (data.tags !== undefined) {
      await replaceTags(conn, id, data.tags);
    }

    await conn.commit();
    return true;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function deletePlaceById(id) {
  const [res] = await pool.execute('UPDATE places SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [id]);
  return res.affectedRows;
}

module.exports = {
  bulkUpsertPlaces,
  listPlaces,
  getMeta,
  getPlaceById,
  createPlace,
  updatePlaceById,
  deletePlaceById,
  getPlacesCities,
  getPlacesBarrios,
};
