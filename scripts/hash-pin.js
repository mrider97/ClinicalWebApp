#!/usr/bin/env node
// ===== PIN HASH HELPER =====
// Generates the SHA-256 pinHash value for a participant PIN.
// Use this when manually creating participant documents in the Firebase console.
//
// Usage:
//   node scripts/hash-pin.js <PIN>
//   node scripts/hash-pin.js 1234
//
// Then paste the printed hash into the 'pinHash' field of the participant document.

const { createHash } = require('crypto');

const pin = process.argv[2];

if (!pin) {
    console.error('Usage: node scripts/hash-pin.js <PIN>');
    process.exit(1);
}

const hash = createHash('sha256').update(pin).digest('hex');

console.log('\nParticipant document fields for Firebase console:');
console.log('------------------------------------------------');
console.log(`pinHash: "${hash}"`);
console.log('\nExample full document:');
console.log(JSON.stringify({
    participantId: 'P001',
    pinHash: hash,
    studyGroup: 'control',
    assignedTests: ['ccpt', 'nback'],
    permissions: 'participant',
    isActive: true,
    sessionsCompleted: 0
}, null, 2));
