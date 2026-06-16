/**
 * Deduplication Helper
 * Provides utilities to normalize place data and detect duplicates
 */

const crypto = require('crypto');

/**
 * Normalize a business name for comparison
 * - Trim whitespace
 * - Convert to lowercase
 * - Remove common business suffixes (S.L., S.A., Ltd., Inc., etc.)
 * - Remove diacritics
 * @param {string} name
 * @returns {string}
 */
function normalizeName(name) {
  if (!name || typeof name !== 'string') return '';

  return name
    .trim()
    .toLowerCase()
    // Remove diacritics (á -> a, é -> e, etc.)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Remove common business suffixes
    .replace(/\s*(s\.?l\.?|s\.?a\.?|s\.?l\.?u\.?|e\.?i\.?r\.?l\.?|ltd\.?|inc\.?|corp\.?|co\.?|llc\.?)\s*$/i, '')
    // Remove extra spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize a website URL for comparison
 * - Remove protocol (http://, https://, ftp://)
 * - Remove www.
 * - Lowercase
 * - Remove trailing slash
 * - Remove query parameters
 * @param {string} url
 * @returns {string}
 */
function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return '';

  return url
    .trim()
    .toLowerCase()
    // Remove protocols
    .replace(/^(https?:\/\/|ftp:\/\/)/, '')
    // Remove www.
    .replace(/^www\./, '')
    // Remove trailing slash
    .replace(/\/$/, '')
    // Remove query parameters and fragments
    .replace(/[?#].*$/, '')
    .trim();
}

/**
 * Normalize phone number for comparison
 * - Remove spaces, dashes, parentheses
 * - Keep only digits
 * @param {string} phone
 * @returns {string}
 */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/[^\d+]/g, '');
}

/**
 * Check if two names are similar (fuzzy match)
 * Uses a simple approach: check if one is contained in the other or if they share most words
 * @param {string} name1
 * @param {string} name2
 * @param {number} threshold - similarity threshold (0-1), default 0.7
 * @returns {boolean}
 */
function areSimilarNames(name1, name2, threshold = 0.7) {
  if (!name1 || !name2) return false;

  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);

  // Exact match
  if (norm1 === norm2) return true;

  // One contains the other (for variations)
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

  // Check if they share significant common words
  const words1 = norm1.split(' ').filter(w => w.length > 2);
  const words2 = norm2.split(' ').filter(w => w.length > 2);

  if (words1.length === 0 || words2.length === 0) return false;

  const commonWords = words1.filter(w => words2.includes(w));
  const similarity = (commonWords.length * 2) / (words1.length + words2.length);

  return similarity >= threshold;
}

/**
 * Check if two places are duplicates based on multiple criteria
 * Priority:
 * 1. Same Google Place ID
 * 2. Same normalized phone
 * 3. Same normalized URL
 * 4. Similar names + same city
 * @param {object} place1
 * @param {object} place2
 * @returns {object} { isDuplicate: boolean, confidence: number, reason: string }
 */
function areDuplicatePlaces(place1, place2) {
  const result = {
    isDuplicate: false,
    confidence: 0,
    reason: null,
  };

  // Check 1: Same Google Place ID (highest confidence)
  if (place1.placeId && place2.placeId && place1.placeId === place2.placeId) {
    result.isDuplicate = true;
    result.confidence = 1.0;
    result.reason = 'same_place_id';
    return result;
  }

  // Check 2: Same normalized phone (high confidence)
  if (place1.phone && place2.phone) {
    const phone1 = normalizePhone(place1.phone);
    const phone2 = normalizePhone(place2.phone);
    if (phone1 && phone2 && phone1 === phone2) {
      result.isDuplicate = true;
      result.confidence = 0.95;
      result.reason = 'same_phone';
      return result;
    }
  }

  // Check 3: Same normalized website (high confidence)
  if (place1.web && place2.web) {
    const web1 = normalizeUrl(place1.web);
    const web2 = normalizeUrl(place2.web);
    if (web1 && web2 && web1 === web2) {
      result.isDuplicate = true;
      result.confidence = 0.95;
      result.reason = 'same_website';
      return result;
    }
  }

  // Check 4: Similar names + same city (medium-high confidence)
  const city1 = (place1.address?.city || place1.city || '').toLowerCase().trim();
  const city2 = (place2.address?.city || place2.city || '').toLowerCase().trim();

  if (city1 && city2 && city1 === city2) {
    if (areSimilarNames(place1.name, place2.name, 0.8)) {
      result.isDuplicate = true;
      result.confidence = 0.85;
      result.reason = 'similar_name_same_city';
      return result;
    }
  }

  // Check 5: Same name + same phone (even if phone is weak signal)
  if (areSimilarNames(place1.name, place2.name, 0.9) && place1.phone && place2.phone && normalizePhone(place1.phone) === normalizePhone(place2.phone)) {
    result.isDuplicate = true;
    result.confidence = 0.9;
    result.reason = 'similar_name_same_phone';
    return result;
  }

  return result;
}

/**
 * Deduplicate an array of places
 * Removes duplicates from the same batch keeping the most complete record
 * @param {array} places - array of place objects
 * @returns {array} - deduplicated array
 */
function deduplicatePlacesList(places) {
  if (!Array.isArray(places) || places.length === 0) return places;

  const seen = new Map();
  const duplicates = [];
  const deduplicated = [];

  for (let i = 0; i < places.length; i++) {
    const place = places[i];

    // Create a key for this place based on its identifiers
    const key = createPlaceKey(place);

    if (seen.has(key)) {
      // Found a duplicate
      const existingIndex = seen.get(key);
      const existingPlace = deduplicated[existingIndex];

      // Keep the more complete record (more fields filled)
      const newCompleteness = countFilledFields(place);
      const existingCompleteness = countFilledFields(existingPlace);

      if (newCompleteness > existingCompleteness) {
        // Replace the existing one with the more complete one
        deduplicated[existingIndex] = place;
        duplicates.push(existingPlace);
      } else {
        duplicates.push(place);
      }
    } else {
      // New place, add it
      seen.set(key, deduplicated.length);
      deduplicated.push(place);
    }
  }

  if (duplicates.length > 0) {
    console.log(`[deduplicatePlacesList] Removed ${duplicates.length} duplicates from batch`);
  }

  return { places: deduplicated, removedCount: duplicates.length, removed: duplicates };
}

/**
 * Create a unique key for a place based on its most reliable identifiers
 * @param {object} place
 * @returns {string}
 */
function createPlaceKey(place) {
  // Priority: placeId > phone > web > name+city > name+barrio > name alone

  // 1. Google Place ID (most reliable)
  if (place.placeId) {
    return `placeId:${place.placeId}`;
  }

  // 2. Normalized phone (very reliable)
  if (place.phone) {
    const normalizedPhone = normalizePhone(place.phone);
    if (normalizedPhone && normalizedPhone.length >= 9) {
      return `phone:${normalizedPhone}`;
    }
  }

  // 3. Normalized web URL (very reliable)
  if (place.web) {
    const normalizedWeb = normalizeUrl(place.web);
    if (normalizedWeb && normalizedWeb.length > 5) {
      return `web:${normalizedWeb}`;
    }
  }

  // 4. Name + city (reliable if both present)
  const city = (place.address?.city || place.city || '').toLowerCase().trim();
  const name = normalizeName(place.name || '');

  if (city && name && name.length > 2) {
    return `name_city:${name}:${city}`;
  }

  // 5. Name + barrio (if city not available)
  const barrio = (place.address?.barrio || place.barrio || '').toLowerCase().trim();
  if (barrio && name && name.length > 2) {
    return `name_barrio:${name}:${barrio}`;
  }

  // 6. Name alone (weak key, but better than nothing)
  if (name && name.length > 3) {
    return `name:${name}`;
  }

  // 7. Last resort: use a combination of all available fields
  const allFields = [
    place.name,
    place.phone,
    place.web,
    place.city,
    place.barrio,
    place.street_address
  ].filter(Boolean).join('|');

  if (allFields) {
    return `allfields:${crypto.createHash('md5').update(allFields).digest('hex')}`;
  }

  // Truly unique key for this call (shouldn't reach here in practice)
  return `unknown:${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Count how many important fields are filled in a place object
 * Used to determine which duplicate to keep
 * @param {object} place
 * @returns {number}
 */
function countFilledFields(place) {
  let count = 0;
  const importantFields = ['name', 'phone', 'web', 'street_address', 'city', 'main_category'];

  for (const field of importantFields) {
    const value = place[field] || (place.address && place.address[field.replace(/_/g, '_')]);
    if (value && String(value).trim()) {
      count += 1;
    }
  }

  return count;
}

module.exports = {
  normalizeName,
  normalizeUrl,
  normalizePhone,
  areSimilarNames,
  areDuplicatePlaces,
  deduplicatePlacesList,
  createPlaceKey,
  countFilledFields,
};
