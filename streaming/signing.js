// V4 signed URL generation for Cloud Storage.
//
// The phone streams audio straight from GCS rather than through this service, so the only
// thing the service hands out is a short-lived signed URL. That is what keeps Cloud Run free
// (it never touches audio bytes) and what gives Media3/ExoPlayer HTTP Range seeking for free.
//
// Signing is pure local crypto over a canonical request - no network call to Google - which is
// why minting on demand, per play, is cheap enough to do instead of pre-minting.
//
// Two signers share all of that construction and differ only in who holds the private key:
// localSigner for a service-account JSON on disk, iamSigner for Cloud Run, where the service
// runs AS a service account and asks IAM to sign the bytes so no key material exists anywhere.

const crypto = require('crypto');

const HOST = 'storage.googleapis.com';
const ALGORITHM = 'GOOG4-RSA-SHA256';

/**
 * Percent-encoding per Google's V4 spec: everything outside the unreserved set, which is
 * stricter than encodeURIComponent (it leaves !'()* alone). Getting this wrong only shows up
 * on tracks with punctuation in the path, which is most of them.
 */
function uriEncode(value) {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** Object names are paths: encode each segment, keep the separators. */
function encodeObjectPath(objectName) {
  return objectName.split('/').map(uriEncode).join('/');
}

function timestamps(now) {
  const iso = new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return {datestamp: iso.slice(0, 8), timestamp: iso};
}

/**
 * Builds everything that must be signed. Separated from signing so it can be tested without a
 * key, and so both signers provably produce the same bytes.
 */
function canonicalRequestFor({bucket, objectName, clientEmail, expiresSeconds, now}) {
  const {datestamp, timestamp} = timestamps(now);
  // "auto" is what Google's own client libraries send; the bucket's real region also works
  const credentialScope = `${datestamp}/auto/storage/goog4_request`;
  const query = [
    ['X-Goog-Algorithm', ALGORITHM],
    ['X-Goog-Credential', `${clientEmail}/${credentialScope}`],
    ['X-Goog-Date', timestamp],
    ['X-Goog-Expires', String(expiresSeconds)],
    ['X-Goog-SignedHeaders', 'host'],
  ];
  // the canonical query string must be sorted by encoded key
  const canonicalQuery = query
    .map(([k, v]) => [uriEncode(k), uriEncode(v)])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const canonicalRequest = [
    'GET',
    `/${bucket}/${encodeObjectPath(objectName)}`,
    canonicalQuery,
    `host:${HOST}`,
    '',
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    ALGORITHM,
    timestamp,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  return {canonicalQuery, canonicalRequest, credentialScope, stringToSign, timestamp};
}

/**
 * Mints a signed URL. `sign` takes the string-to-sign and returns a hex RSA-SHA256 signature,
 * which is the only part that differs between running locally and running on Cloud Run.
 */
async function signedUrl(options, sign) {
  const {bucket, objectName} = options;
  const {canonicalQuery, stringToSign} = canonicalRequestFor(options);
  const signature = await sign(stringToSign);
  return `https://${HOST}/${bucket}/${encodeObjectPath(objectName)}` +
    `?${canonicalQuery}&X-Goog-Signature=${signature}`;
}

/** Signs with a private key held locally - a service-account JSON on disk. */
function localSigner(privateKeyPem) {
  return async (stringToSign) =>
    crypto.createSign('RSA-SHA256').update(stringToSign).sign(privateKeyPem, 'hex');
}

/**
 * Signs via IAM's signBlob, for Cloud Run: the service has no key file, it just has permission
 * to ask IAM to sign as itself (roles/iam.serviceAccountTokenCreator on its own identity).
 */
function iamSigner(clientEmail, accessToken) {
  return async (stringToSign) => {
    const url = 'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/' +
      `${encodeURIComponent(clientEmail)}:signBlob`;
    const res = await fetch(url, {
      body: JSON.stringify({payload: Buffer.from(stringToSign).toString('base64')}),
      headers: {
        'Authorization': `Bearer ${await accessToken()}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`signBlob failed (${res.status}): ${text.slice(0, 200)}`);
    }
    // signBlob returns base64; the URL wants hex
    return Buffer.from(JSON.parse(text).signedBlob, 'base64').toString('hex');
  };
}

module.exports = {
  canonicalRequestFor,
  encodeObjectPath,
  iamSigner,
  localSigner,
  signedUrl,
  uriEncode,
};
