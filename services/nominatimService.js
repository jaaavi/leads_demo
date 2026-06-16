const https = require('https');

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';
const REQUEST_TIMEOUT = 5000;
const RATE_LIMIT_DELAY = 1000; // 1 second between requests to respect Nominatim rate limits

/**
 * Query Nominatim API for address geocoding with address details
 * Returns enriched address data including city, neighborhood, etc.
 */
async function geocodeAddress(street, city, country, state = null) {
  // Skip if we don't have enough data to query
  if (!street || !city || !country) {
    return null;
  }

  try {
    // Build the query parameters
    const params = new URLSearchParams({
      street: street,
      city: city,
      format: 'json',
      addressdetails: '1',
    });

    // Use ISO country code if provided (prefer countrycodes), else free-form country
    if (country) {
      if (/^[A-Za-z]{2}$/.test(country)) {
        params.set('countrycodes', country.toLowerCase());
      } else {
        params.set('country', country);
      }
    }

    // Include state when available to improve accuracy
    if (state) {
      params.set('state', state);
    }

    const url = `${NOMINATIM_BASE_URL}?${params.toString()}`;

    // Add user-agent to comply with Nominatim ToS
    const options = {
      headers: {
        'User-Agent': 'LeadOps-Geocoder/1.0 (admin@example.com)',
        'Accept-Language': 'es',
      },
    };

    const result = await new Promise((resolve, reject) => {
      const req = https.get(url, options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const results = JSON.parse(data);
              resolve(results);
            } else if (res.statusCode === 429) {
              // Rate limited
              reject(new Error('Nominatim rate limit exceeded'));
            } else {
              reject(new Error(`Nominatim API returned status ${res.statusCode}`));
            }
          } catch (e) {
            reject(new Error(`Failed to parse Nominatim response: ${e.message}`));
          }
        });
      });

      req.on('error', reject);

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Nominatim API request timeout'));
      });

      req.setTimeout(REQUEST_TIMEOUT);
    });

    return result;
  } catch (error) {
    console.error(`Nominatim geocoding error for ${street}, ${city}, ${country}:`, error.message);
    return null;
  }
}

/**
 * Extract enriched address data from Nominatim response
 * Returns { city, barrio } from the address details
 */
function extractAddressData(nominatimResults) {
  if (!Array.isArray(nominatimResults) || nominatimResults.length === 0) {
    return null;
  }

  const result = nominatimResults[0];
  const addressDetails = result.address || {};

  return {
    city: addressDetails.city || addressDetails.town || addressDetails.municipality || addressDetails.village || null,
    barrio: addressDetails.suburb || addressDetails.neighbourhood || addressDetails.neighborhood || addressDetails.quarter || addressDetails.borough || addressDetails.city_district || null,
  };
}

/**
 * Enrich address data using Nominatim API
 * Takes street, city, country and returns enriched { city, barrio }
 */
async function enrichAddress(street, city, country, state = null) {
  const results = await geocodeAddress(street, city, country, state);
  if (!results) {
    return null;
  }

  return extractAddressData(results);
}

/**
 * Enrich address with rate limiting (pause between requests)
 */
async function enrichAddressWithRateLimit(street, city, country, state = null) {
  await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
  return enrichAddress(street, city, country, state);
}

module.exports = {
  geocodeAddress,
  extractAddressData,
  enrichAddress,
  enrichAddressWithRateLimit,
};
