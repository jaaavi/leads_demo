/**
 * Configuration for excluded categories and domains
 * Places and leads with these categories or domains should not be displayed or inserted
 */

const EXCLUDED_CATEGORIES = [
  'Oficina de atención al ciudadano',
  'Oficina de la Seguridad Social',
  'Oficina de gobierno local',
  'Oficina del Gobierno',
  'Oficina tributaria municipal',
  'Oficina de registro',
  'Comisaría de policía',
  'Ayuntamiento',
  'Consejo comarcal',
  'Registro civil',
  'Delegación de Servicios Sociales',
  'Consejería',
  'Ministerio',
  'Junta Municipal',
  'Centro de salud',
  'Hospital',
  'Ambulatorio',
  'Farmacia',
  'Banco',
  'Cajeros automáticos',
  'CaixaBank',
  'BBVA',
  'Santander',
  'Oficina de licencias',
  'Oficina de empleo',
  'Oficina del INEM',
  'Oficina de Hacienda',
  'Gestoría pública',
  'Correos',
  'Centro de mayores',
  'Colegio público',
  'Instituto de educación secundaria',
  'Universidad pública',
  'Supermercado',
  'Hipermercado',
  'Tienda general',
  'Distribuidor de máquinas expendedoras automáticas',
  'Gasolinera',
  'Compañía telefónica',
  'Oficina de seguros',
  'Aseguradora',
  'Funeraria',
  'Cementerio',
  'Iglesia',
  'Parroquia',
  'Convento',
  'Templo',
  'Mosquea',
  'Sinagoga',
  'Embajada',
  'Consulado',
  'Juzgado',
  'Notaría',
  'Registro mercantil',
  'Delegación de tráfico',
  'Polideportivo municipal',
  'Centro deportivo municipal',
  'Museo nacional',
  'Biblioteca pública',
  'Centro cultural municipal',
  'Parking público',
  'Aparcamiento',
  'Estación de metro',
  'Estación de tren',
  'Taller oficial',
  'Concesionario oficial'
];

const EXCLUDED_DOMAINS = [
  'madrid.es',
  'misecretaria.es',
  'locales.sportium.es',
  'hawkersco.com',
  'vicio.com',
  'ahorramas.com',
  'latagliatella.es',
  'juanchosbbq.com',
  'revolut.com',
  'vips.es',
  'naturgy.es',
  'burgerking.es',
  'soloptical.net',
  'mcdonalds.es',
  'telepizza.es',
  'pizzahut.es',
  'dominos.es',
  'tgb.com',
  'fosterhollywood.es',
  'kfc.es',
  'tacobell.es',
  'subway.com',
  'pansandcompany.com',
  'rodilla.es',
  'papa-johns.es',
  '100montaditos.com',
  'cerveceriacienmontaditos.es',
  'starbucks.es',
  'cinesa.es',
  'yelmocines.es',
  'decathlon.es',
  'ikea.es',
  'carrefour.es',
  'lidl.es',
  'mercadona.es',
  'dia.es',
  'aldi.es',
  'eroski.es',
  'fnac.es',
  'mediamarkt.es',
  'sprinter.es',
  'lefties.com',
  'zara.com',
  'bershka.com',
  'pullandbear.com',
  'stradivarius.com',
  'massimodutti.com',
  'mango.com',
  'primark.com',
  'druni.es',
  'douglas.es',
  'sephora.es',
  'movistar.es',
  'vodafone.es',
  'orange.es',
  'yoigo.com',
  'jazztel.com',
  'repsol.com',
  'cepsa.es',
  'bp.com',
  'mapfre.es',
  'allianz.es',
  'axa.es',
  'sanitas.es',
  'admiral.es',
  'lineadirecta.com',
  'mutua.es',
  'bbva.es',
  'caixabank.es',
  'santander.com',
  'ing.es',
  'openbank.es',
  'bankinter.com',
  'sabadellatlantico.com'
];

/**
 * Extracts the domain from a URL
 * @param {string} url - The URL to extract domain from
 * @returns {string|null} - The domain name or null if invalid
 */
function extractDomain(url) {
  if (!url || typeof url !== 'string') return null;

  try {
    let urlStr = url.trim();
    if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
      urlStr = 'https://' + urlStr;
    }

    const urlObj = new URL(urlStr);
    return urlObj.hostname.toLowerCase();
  } catch (e) {
    return null;
  }
}

/**
 * Checks if a domain is in the excluded list
 * @param {string} domain - The domain to check
 * @returns {boolean} - True if domain is excluded
 */
function isExcludedDomain(domain) {
  if (!domain) return false;

  const domainLower = domain.toLowerCase();

  // Check for exact match or as subdomain
  return EXCLUDED_DOMAINS.some(excludedDomain => {
    const excludedLower = excludedDomain.toLowerCase();
    return domainLower === excludedLower || domainLower.endsWith('.' + excludedLower);
  });
}

/**
 * Checks if a category (or categories) contains any excluded category
 * @param {string} rawCategories - Raw categories (comma-separated or single)
 * @returns {boolean} - True if any excluded category is found
 */
function hasExcludedCategory(rawCategories) {
  if (!rawCategories) return false;

  const categoriesText = String(rawCategories).toLowerCase();

  // Check if any excluded category matches (case-insensitive)
  return EXCLUDED_CATEGORIES.some(excluded => {
    const excludedLower = excluded.toLowerCase();
    // Check for exact word match to avoid partial matches
    return categoriesText.includes(excludedLower);
  });
}

/**
 * Checks if a place should be excluded based on its category or domain
 * @param {object} place - The place object with name, category, web properties
 * @returns {boolean} - True if the place should be excluded
 */
function shouldExcludePlace(place) {
  if (!place) return true;

  // Check excluded categories
  if (place.category && hasExcludedCategory(place.category)) {
    return true;
  }

  if (place.raw_categories && hasExcludedCategory(place.raw_categories)) {
    return true;
  }

  // Check excluded domains
  if (place.web) {
    const domain = extractDomain(place.web);
    if (domain && isExcludedDomain(domain)) {
      return true;
    }
  }

  return false;
}

module.exports = {
  EXCLUDED_CATEGORIES,
  EXCLUDED_DOMAINS,
  extractDomain,
  isExcludedDomain,
  hasExcludedCategory,
  shouldExcludePlace
};
