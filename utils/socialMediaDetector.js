/**
 * Detects if a URL is a social media platform or a real website
 */

const SOCIAL_MEDIA_PATTERNS = [
  // Facebook
  /facebook\.com/i,
  /fb\.com/i,
  // Instagram
  /instagram\.com/i,
  // TikTok
  /tiktok\.com/i,
  /vm\.tiktok\.com/i,
  // Twitter/X
  /twitter\.com/i,
  /x\.com/i,
  // LinkedIn
  /linkedin\.com/i,
  // YouTube
  /youtube\.com/i,
  /youtu\.be/i,
  // Pinterest
  /pinterest\.com/i,
  // Snapchat
  /snapchat\.com/i,
  // WhatsApp (business/chat links)
  /wa\.me/i,
  /whatsapp\.com/i,
  // Telegram
  /t\.me/i,
  /telegram\.me/i,
  // Linktree and similar
  /linktree\.com/i,
  /linktr\.ee/i,
  /beacons\.ai/i,
  /bio\.fm/i,
  /carrd\.co/i,
  /link\.bio/i,
  /about\.me/i,
  // Google Business Profile
  /google\.com\/maps/i,
  /maps\.google\.com/i,
  /google\.es\/maps/i,
  // Wix, Shopify, etc (platforms)
  /wix\.com/i,
  /shopify\.com/i,
  /blogspot\.com/i,
  /weebly\.com/i,
  /squarespace\.com/i,
];

/**
 * Check if a URL is a social media platform
 * @param {string} url - The URL to check
 * @returns {boolean} - True if it's a social media URL
 */
function isSocialMedia(url) {
  if (!url || typeof url !== 'string') return false;
  
  const trimmedUrl = url.trim().toLowerCase();
  if (!trimmedUrl) return false;
  
  return SOCIAL_MEDIA_PATTERNS.some(pattern => pattern.test(trimmedUrl));
}

/**
 * Classify web presence type
 * @param {string} web - The web field value
 * @returns {string} - 'real_web', 'social_media', or 'none'
 */
function classifyWebPresence(web) {
  if (!web || typeof web !== 'string' || !web.trim()) {
    return 'none';
  }
  
  if (isSocialMedia(web)) {
    return 'social_media';
  }
  
  return 'real_web';
}

/**
 * Check if place has real website (not social media)
 * @param {string} web - The web field value
 * @returns {boolean}
 */
function hasRealWeb(web) {
  return classifyWebPresence(web) === 'real_web';
}

/**
 * Check if place has only social media
 * @param {string} web - The web field value
 * @returns {boolean}
 */
function hasOnlySocialMedia(web) {
  return classifyWebPresence(web) === 'social_media';
}

module.exports = {
  isSocialMedia,
  classifyWebPresence,
  hasRealWeb,
  hasOnlySocialMedia,
};
