#!/usr/bin/env node
// Mints a device token. Run once per device; never at runtime.
//
//   node streaming/mint-token.js "daniel-phone"
//
// Prints the token (goes in the app, shown once) and the hash (goes in STREAM_DEVICE_TOKENS on
// the service). The service only ever stores hashes, so losing the token means minting a new
// one rather than looking the old one up.

const {mintToken} = require('./auth');

const label = (process.argv[2] || '').trim();
if (!label || /[,:]/.test(label)) {
  console.error('usage: node streaming/mint-token.js <device-label>   (no commas or colons)');
  process.exit(1);
}

const {hash, token} = mintToken();
console.log(`\ndevice        ${label}`);
console.log(`token         ${token}`);
console.log(`                ^ put this in the app on that device; it is not recoverable\n`);
console.log(`allowlist entry (append to STREAM_DEVICE_TOKENS, comma-separated):`);
console.log(`  ${hash}:${label}\n`);
