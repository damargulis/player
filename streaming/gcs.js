// Credentials and reads for the streaming service.
//
// Two modes, deliberately: on Cloud Run the service runs AS a service account and gets both
// its token and its identity from the metadata server, so there is no key file anywhere. For
// local work it falls back to a service-account JSON. Everything downstream - listing the
// catalog, signing URLs - takes a token getter and an email, so neither cares which mode it is.

const crypto = require('crypto');
const fs = require('fs');

const METADATA = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default';
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

function b64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Token + identity from the Cloud Run metadata server. No key material involved. */
async function metadataCredentials() {
  const headers = {'Metadata-Flavor': 'Google'};
  const emailRes = await fetch(`${METADATA}/email`, {headers});
  if (!emailRes.ok) {
    throw new Error(`metadata server unavailable (${emailRes.status})`);
  }
  const clientEmail = (await emailRes.text()).trim();
  let cached = null;
  const accessToken = async () => {
    if (cached && cached.expires > Date.now() + 60000) {
      return cached.value;
    }
    const res = await fetch(`${METADATA}/token`, {headers});
    if (!res.ok) {
      throw new Error(`metadata token failed (${res.status})`);
    }
    const body = await res.json();
    cached = {expires: Date.now() + body.expires_in * 1000, value: body.access_token};
    return cached.value;
  };
  return {accessToken, clientEmail, mode: 'metadata'};
}

/** Local fallback: a service-account JSON, exchanged for a token the usual JWT way. */
function keyFileCredentials(keyPath) {
  const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  let cached = null;
  const accessToken = async () => {
    if (cached && cached.expires > Date.now() + 60000) {
      return cached.value;
    }
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
      iss: key.client_email,
      scope: SCOPE,
    };
    const unsigned = `${b64url(JSON.stringify({alg: 'RS256', typ: 'JWT'}))}.` +
      `${b64url(JSON.stringify(claim))}`;
    const signature = crypto.createSign('RSA-SHA256').update(unsigned)
      .sign(key.private_key, 'base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const res = await fetch('https://oauth2.googleapis.com/token', {
      body: new URLSearchParams({
        assertion: `${unsigned}.${signature}`,
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      }),
      method: 'POST',
    });
    if (!res.ok) {
      throw new Error(`token exchange failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    }
    const body = await res.json();
    cached = {expires: Date.now() + body.expires_in * 1000, value: body.access_token};
    return cached.value;
  };
  return {accessToken, clientEmail: key.client_email, key, mode: 'keyfile'};
}

async function resolveCredentials(keyPath) {
  if (keyPath && fs.existsSync(keyPath)) {
    return keyFileCredentials(keyPath);
  }
  return metadataCredentials();
}

/**
 * Finds the newest catalog object.
 *
 * Names are ISO timestamps, which sort lexically, so "newest" is just the last name - no need
 * to fetch metadata for each. Timestamped names exist because the publishing key cannot
 * replace an object.
 */
async function newestCatalogName(bucket, accessToken, prefix = 'catalog/') {
  const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o` +
    `?prefix=${encodeURIComponent(prefix)}&fields=items(name),nextPageToken`;
  let pageToken;
  let newest = null;
  do {
    const res = await fetch(pageToken ? `${url}&pageToken=${pageToken}` : url, {
      headers: {Authorization: `Bearer ${await accessToken()}`},
    });
    if (!res.ok) {
      throw new Error(`catalog listing failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    }
    const body = await res.json();
    (body.items || []).forEach((item) => {
      if (!newest || item.name > newest) {
        newest = item.name;
      }
    });
    pageToken = body.nextPageToken;
  } while (pageToken);
  return newest;
}

async function getObject(bucket, objectName, accessToken) {
  const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/` +
    `${encodeURIComponent(objectName)}?alt=media`;
  const res = await fetch(url, {headers: {Authorization: `Bearer ${await accessToken()}`}});
  if (!res.ok) {
    throw new Error(`object fetch failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  return res.text();
}

module.exports = {getObject, keyFileCredentials, newestCatalogName, resolveCredentials};
