// Per-device bearer tokens.
//
// The audience is two people and a handful of devices, so this is deliberately not OAuth. A
// device holds one long random token; the service holds only SHA-256 hashes of the valid ones,
// so the deployment config is not itself a set of credentials. Revoking a lost phone means
// dropping one hash and redeploying.
//
// Hashing first has a second benefit: every comparison is over 32 bytes, so timingSafeEqual
// applies cleanly without the length-leak that comparing raw tokens would have.

const crypto = require('crypto');

/** `STREAM_DEVICE_TOKENS=<sha256hex>:<label>,<sha256hex>:<label>` - labels are for logs only. */
function parseAllowlist(raw) {
  return (raw || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hash, label] = entry.split(':');
      return {hash: (hash || '').trim().toLowerCase(), label: (label || 'unnamed').trim()};
    })
    .filter((entry) => /^[0-9a-f]{64}$/.test(entry.hash));
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest();
}

/** Pulls the bearer token out of an Authorization header, or null. */
function bearerFrom(header) {
  const match = /^Bearer\s+(.+)$/i.exec(header || '');
  return match ? match[1].trim() : null;
}

/**
 * Returns the matching device's label, or null. Every candidate is compared even after a match
 * so the work does not depend on allowlist position.
 */
function authenticate(header, allowlist) {
  const token = bearerFrom(header);
  if (!token) {
    return null;
  }
  const digest = hashToken(token);
  let found = null;
  allowlist.forEach((entry) => {
    const candidate = Buffer.from(entry.hash, 'hex');
    if (candidate.length === digest.length && crypto.timingSafeEqual(candidate, digest)) {
      found = entry.label;
    }
  });
  return found;
}

/**
 * Mints a token and its hash - used once per device, never at runtime.
 *
 * The base64url conversion is manual because the tests run inside Electron 13 (Node 14), which
 * predates the 'base64url' encoding this service's own Node 18 runtime has.
 */
function mintToken() {
  const token = crypto.randomBytes(32).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return {hash: crypto.createHash('sha256').update(token, 'utf8').digest('hex'), token};
}

module.exports = {authenticate, bearerFrom, hashToken, mintToken, parseAllowlist};
