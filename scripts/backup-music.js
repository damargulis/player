#!/usr/bin/env node
/**
 * Uploads the music library to the GCS backup bucket, one object per file.
 *
 * Deliberately a standalone script rather than part of the app: this is ~163GB and roughly a
 * day of wall-clock, which has no business running inside an Electron renderer. It is
 * restartable — a manifest records what has landed, so stopping it and running it again picks
 * up where it left off.
 *
 *   node scripts/backup-music.js [--limit N] [--concurrency N] [--dry-run]
 *
 * Objects are named music/<path relative to home>, mirroring the filesystem so the backup can
 * be restored by hand without this app or the library file. The service account is
 * objectCreator-only, so an object that already exists is never replaced; such files are
 * skipped rather than retried.
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOME = os.homedir();
const DATA_DIR = `${HOME}/Library/Application Support/electron-react/data`;
const KEY_FILE = `${DATA_DIR}/gcs-backup-key.json`;
const LIBRARY = `${DATA_DIR}/library.json`;
const MANIFEST = `${DATA_DIR}/music-backup-manifest.json`;

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
};
const LIMIT = flag('--limit', Infinity);
const CONCURRENCY = flag('--concurrency', 8);
const DRY_RUN = args.includes('--dry-run');

const BUCKET = (() => {
  for (const f of [`${process.cwd()}/.env.local`, `${DATA_DIR}/.env`]) {
    try {
      const line = fs.readFileSync(f, 'utf8').split('\n').find((l) => l.startsWith('GCS_BACKUP_BUCKET='));
      if (line) return line.slice('GCS_BACKUP_BUCKET='.length).trim();
    } catch (e) { /* try the next one */ }
  }
  return undefined;
})();

const CONTENT_TYPES = {
  '.aac': 'audio/aac', '.aiff': 'audio/aiff', '.flac': 'audio/flac', '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.opus': 'audio/opus', '.wav': 'audio/wav',
  '.wma': 'audio/x-ms-wma',
};

const b64url = (b) => Buffer.from(b).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const key = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
let token = {value: null, expires: 0};

/** Runs for hours, so the hour-long token has to be renewed mid-flight. */
async function accessToken() {
  if (token.value && Date.now() < token.expires - 120000) return token.value;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({alg: 'RS256', typ: 'JWT'}));
  const claim = b64url(JSON.stringify({
    aud: key.token_uri, exp: now + 3600, iat: now, iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/devstorage.read_write',
  }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const res = await fetch(key.token_uri, {
    method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      assertion: `${header}.${claim}.${b64url(signer.sign(key.private_key))}`,
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    }).toString(),
  });
  if (!res.ok) throw new Error(`auth failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  token = {value: body.access_token, expires: Date.now() + body.expires_in * 1000};
  return token.value;
}

function trackPaths() {
  const lib = JSON.parse(fs.readFileSync(LIBRARY, 'utf8'));
  const seen = new Set();
  const out = [];
  for (const track of Object.values(lib.tracks)) {
    let p = track.filePath || '';
    if (p.startsWith('file://')) p = p.slice(7);
    try { p = decodeURIComponent(p); } catch (e) { /* use as-is */ }
    if (p && !seen.has(p)) { seen.add(p); out.push(p); }
  }
  return out;
}

function loadManifest() {
  try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) { return {}; }
}

let manifest = loadManifest();
let dirty = false;
function saveManifest() {
  if (!dirty) return;
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest));
  dirty = false;
}

function human(bytes) {
  if (bytes > 1073741824) return `${(bytes / 1073741824).toFixed(1)}GB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

async function uploadOne(file) {
  const name = `music/${path.relative(HOME, file)}`;
  const stat = fs.statSync(file);
  const done = manifest[name];
  if (done && done.size === stat.size) return {skipped: true, bytes: 0};
  if (DRY_RUN) return {uploaded: true, bytes: stat.size, dry: true};

  const type = CONTENT_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(BUCKET)}` +
    `/o?uploadType=media&name=${encodeURIComponent(name)}`;
  const res = await fetch(url, {
    method: 'POST', body: fs.readFileSync(file),
    headers: {Authorization: `Bearer ${await accessToken()}`, 'Content-Type': type},
  });
  if (res.status === 403) {
    // already there from an earlier run whose manifest entry was lost; the key cannot replace
    manifest[name] = {size: stat.size, already: true};
    dirty = true;
    return {skipped: true, bytes: 0};
  }
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
  manifest[name] = {size: stat.size};
  dirty = true;
  return {uploaded: true, bytes: stat.size};
}

(async () => {
  if (!BUCKET) { console.error('No GCS_BACKUP_BUCKET found in .env.local or the data dir .env'); process.exit(1); }
  const all = trackPaths();
  const existing = all.filter((p) => fs.existsSync(p));
  const missing = all.length - existing.length;
  const todo = existing.filter((p) => {
    const entry = manifest[`music/${path.relative(HOME, p)}`];
    return !entry || entry.size !== fs.statSync(p).size;
  }).slice(0, LIMIT);

  const totalBytes = todo.reduce((n, p) => n + fs.statSync(p).size, 0);
  console.log(`bucket      ${BUCKET}${DRY_RUN ? '  (DRY RUN)' : ''}`);
  console.log(`tracks      ${all.length} in library, ${missing} missing on disk`);
  console.log(`already up  ${Object.keys(manifest).length}`);
  console.log(`to upload   ${todo.length} files, ${human(totalBytes)}`);
  if (!todo.length) { console.log('\nNothing to do.'); return; }
  console.log(`concurrency ${CONCURRENCY}\n`);

  let done = 0, sent = 0, failed = 0;
  const started = Date.now();
  const failures = [];
  let next = 0;
  const save = setInterval(saveManifest, 10000);
  process.on('SIGINT', () => { saveManifest(); console.log('\nStopped. Re-run to resume.'); process.exit(0); });

  await Promise.all(Array.from({length: Math.min(CONCURRENCY, todo.length)}, async () => {
    while (next < todo.length) {
      const file = todo[next++];
      try {
        const r = await uploadOne(file);
        sent += r.bytes;
      } catch (e) {
        failed++;
        if (failures.length < 20) failures.push(`${path.basename(file)}: ${e.message}`);
      }
      done++;
      if (done % 25 === 0 || done === todo.length) {
        const secs = (Date.now() - started) / 1000;
        const rate = sent / 1048576 / secs;
        const left = (totalBytes - sent) / 1048576 / Math.max(rate, 0.01) / 3600;
        process.stdout.write(`\r  ${done}/${todo.length}  ${human(sent)} sent  ` +
          `${rate.toFixed(1)}MB/s  ~${left.toFixed(1)}h left  ${failed} failed   `);
      }
    }
  }));

  clearInterval(save);
  saveManifest();
  console.log(`\n\nDone. ${human(sent)} uploaded, ${failed} failed.`);
  if (failures.length) { console.log('First failures:'); failures.forEach((f) => console.log('  ' + f)); }
})().catch((e) => { saveManifest(); console.error('\nFAILED: ' + e.message); process.exit(1); });
