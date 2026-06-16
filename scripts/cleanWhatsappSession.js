#!/usr/bin/env node

/**
 * Clean WhatsApp Session Script
 * Removes stored session/credentials for a given instance
 * Useful when a session is stuck or corrupted
 * 
 * Usage:
 *   node scripts/cleanWhatsappSession.js [instanceId]
 * 
 * Example:
 *   node scripts/cleanWhatsappSession.js main-bot
 */

const fs = require('fs');
const path = require('path');

const instanceId = process.argv[2] || 'main-bot';
const sessionDir = path.join(__dirname, '..', 'bot_sessions', instanceId);

console.log(`Cleaning WhatsApp session: ${instanceId}`);
console.log(`Session directory: ${sessionDir}`);

if (!fs.existsSync(sessionDir)) {
  console.log('Session directory does not exist. Nothing to clean.');
  process.exit(0);
}

try {
  fs.rmSync(sessionDir, { recursive: true, force: true });
  console.log(`✓ Session cleaned successfully. You can now scan a new QR code.`);
  process.exit(0);
} catch (err) {
  console.error(`✗ Error cleaning session:`, err.message);
  process.exit(1);
}
