#!/usr/bin/env node
// Streaming service for MyMusic. Runs on Cloud Run; zero dependencies, Node 18+ for fetch.
//
// The laptop is a publisher, never part of playback: it pushes audio to music/ and an index to
// catalog/, and may be asleep. Everything the phone needs comes from here.
//
// This service never touches audio bytes. It answers "what exists?" and "where is track X?",
// handing back a short-lived V4 signed URL that the phone streams straight from GCS. That is
// what keeps it inside the free tier and what gives ExoPlayer HTTP Range seeking for free.
//
//   GET /health          - unauthenticated liveness
//   GET /catalog         - the track list (no object names)
//   GET /track/:id       - {url, expiresAt} for one track
//
// Config: GCS_BACKUP_BUCKET, STREAM_DEVICE_TOKENS (see auth.js), optional GCS_KEY_FILE for
// local runs and STREAM_URL_TTL_SECONDS / STREAM_CATALOG_TTL_SECONDS to tune lifetimes.

const {authenticate, parseAllowlist} = require('./auth');
const {getObject, newestCatalogName, resolveCredentials} = require('./gcs');
const http = require('http');
const {iamSigner, localSigner, signedUrl} = require('./signing');

const BUCKET = process.env.GCS_BACKUP_BUCKET;
const PORT = Number(process.env.PORT || 8080);
const ALLOWLIST = parseAllowlist(process.env.STREAM_DEVICE_TOKENS);
// An hour is far longer than a track and short enough that a leaked URL is nearly worthless.
const URL_TTL = Number(process.env.STREAM_URL_TTL_SECONDS || 3600);
// The catalog changes at most daily, so this is about bounding staleness, not load.
const CATALOG_TTL = Number(process.env.STREAM_CATALOG_TTL_SECONDS || 600) * 1000;

let credentials = null;
let signer = null;
let catalogCache = null;

async function ready() {
  if (!credentials) {
    credentials = await resolveCredentials(process.env.GCS_KEY_FILE);
    // on Cloud Run there is no private key to sign with, so ask IAM to sign as ourselves
    signer = credentials.key
      ? localSigner(credentials.key.private_key)
      : iamSigner(credentials.clientEmail, credentials.accessToken);
  }
  return credentials;
}

/**
 * The newest catalog, cached.
 *
 * Held in memory rather than refetched per request: a cold instance pays one list plus one
 * download, and every request after that is free until the TTL lapses.
 */
async function catalog() {
  if (catalogCache && catalogCache.expires > Date.now()) {
    return catalogCache.value;
  }
  const {accessToken} = await ready();
  const name = await newestCatalogName(BUCKET, accessToken);
  if (!name) {
    throw new Error('no catalog has been published yet');
  }
  const parsed = JSON.parse(await getObject(BUCKET, name, accessToken));
  const byId = new Map(parsed.tracks.map((t) => [t.id, t]));
  // the phone never needs object names, and not sending them keeps the bucket layout private.
  // Album and artist ids DO go out: they are the desktop's own id space, which is what lets
  // the phone merge cloud tracks into the library it already has rather than listing them
  // separately. They name nothing in storage.
  const listing = parsed.tracks.map(({object, ...rest}) => rest);
  const value = {
    albums: parsed.albums || [],
    artists: parsed.artists || [],
    byId,
    generatedAt: parsed.generatedAt,
    listing,
    source: name,
  };
  catalogCache = {expires: Date.now() + CATALOG_TTL, value};
  return value;
}

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(payload),
    'Content-Type': 'application/json',
  });
  res.end(payload);
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;

  if (path === '/health') {
    return send(res, 200, {ok: true});
  }

  const device = authenticate(req.headers.authorization, ALLOWLIST);
  if (!device) {
    // deliberately uninformative: a probe learns nothing about which half was wrong
    return send(res, 401, {error: 'unauthorized'});
  }

  if (path === '/catalog') {
    const {albums, artists, generatedAt, listing} = await catalog();
    return send(res, 200, {
      albums,
      artists,
      count: listing.length,
      generatedAt,
      tracks: listing,
    });
  }

  const track = /^\/track\/(.+)$/.exec(path);
  if (track) {
    const id = decodeURIComponent(track[1]);
    const {byId} = await catalog();
    const entry = byId.get(id);
    if (!entry) {
      // either genuinely unknown or not uploaded yet; the phone shows "not available offline"
      return send(res, 404, {error: 'not in catalog'});
    }
    const {clientEmail} = await ready();
    const expiresAt = new Date(Date.now() + URL_TTL * 1000).toISOString();
    const signed = await signedUrl({
      bucket: BUCKET,
      clientEmail,
      expiresSeconds: URL_TTL,
      now: Date.now(),
      objectName: entry.object,
    }, signer);
    return send(res, 200, {expiresAt, id, url: signed});
  }

  return send(res, 404, {error: 'not found'});
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(`${req.method} ${req.url} failed:`, err.message);
    send(res, 500, {error: 'internal error'});
  });
});

if (require.main === module) {
  if (!BUCKET) {
    throw new Error('GCS_BACKUP_BUCKET is not set');
  }
  if (!ALLOWLIST.length) {
    // failing loudly beats starting a service that would deny every request
    throw new Error('STREAM_DEVICE_TOKENS is empty; no device could authenticate');
  }
  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`streaming service on :${PORT}, ${ALLOWLIST.length} device(s) allowed`);
  });
}

module.exports = {handle, server};
