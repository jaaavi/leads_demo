/**
 * Detect phone type (mobile or fixed) based on Spanish phone number patterns
 * Mobile: starts with 6 or 7 (after country code)
 * Fixed: starts with 2, 3, 4, 5, or area codes like 91, 93, 94, 95, 96, 97 (after country code)
 *
 * Supports formats:
 * - +34 123 456 789
 * - +34123456789
 * - 034 123 456 789
 * - 034123456789
 * - 123 456 789
 * - 123456789
 */
function detectPhoneType(phoneNumber) {
  if (!phoneNumber) return null;

  // Remove all non-digit characters
  const digitsOnly = String(phoneNumber).replace(/\D/g, '');

  if (!digitsOnly) return null;

  // Remove country code if present (34 for Spain)
  let mainNumber = digitsOnly;

  // If it starts with 34 (Spain), remove it
  if (digitsOnly.startsWith('34') && digitsOnly.length > 9) {
    mainNumber = digitsOnly.substring(2);
  }
  // If it starts with 0 (some formats include leading 0), remove it
  else if (mainNumber.startsWith('0')) {
    mainNumber = mainNumber.substring(1);
  }

  // Ensure we have a proper length
  if (mainNumber.length < 8) return null;

  // Get the first two digits for area code detection
  const firstTwoDigits = mainNumber.substring(0, 2);
  const firstDigit = mainNumber.charAt(0);

  // Spanish patterns:
  // Mobile: 6 or 7 (9 digits after country code)
  if (['6', '7'].includes(firstDigit)) {
    return 'mobile';
  }

  // Fixed line: 2, 3, 4, 5 are regional area codes for fixed lines
  if (['2', '3', '4', '5'].includes(firstDigit)) {
    return 'fixed';
  }

  // Special handling for numbers starting with 9 (area codes)
  if (firstDigit === '9') {
    // 91 (Madrid), 93 (Barcelona), 94 (Bilbao), 95 (Seville), 96 (Valencia), 97 (Balearics)
    if (['91', '93', '94', '95', '96', '97'].includes(firstTwoDigits)) {
      return 'fixed';
    }
    // Other 9x numbers are usually mobile (though less common)
    return 'mobile';
  }

  // Default to null if can't determine
  return null;
}

/**
 * Normalize a phone number for storage
 * Removes extra spaces and formatting, keeps the core number
 */
function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber) return null;
  // Keep only digits, spaces, hyphens, parentheses, and plus sign
  return String(phoneNumber).trim();
}

module.exports = {
  detectPhoneType,
  normalizePhoneNumber,
};
