#!/usr/bin/env node
// Publishes the stream catalog immediately, instead of waiting up to 24h for the app's daily
// timer to do it (src/backup/catalog.tsx, which is the normal path).
//
// Worth having for the same reason scripts/backup-music.js is: verifying a deploy, or picking
// up a big batch of newly uploaded music, should not mean waiting a day. During the initial
// bulk upload the catalog goes stale by thousands of tracks between app ticks.
//
// This DUPLICATES buildCatalog() rather than importing it - that module is TypeScript and
// pulls in Electron via constants.tsx, so it cannot be required from plain node. Keep the two
// in step: object naming, the manifest intersection, and the field set must match, or the
// service will serve a catalog the app would not have produced.
const crypto = require('crypto'), fs = require('fs'), os = require('os'), path = require('path');
const HOME = os.homedir();
const D = `${HOME}/Library/Application Support/electron-react/data`;
const key = JSON.parse(fs.readFileSync(`${D}/gcs-backup-key.json`, 'utf8'));
const BUCKET = fs.readFileSync('.env.local', 'utf8').split('\n')
  .find((l) => l.startsWith('GCS_BACKUP_BUCKET=')).split('=')[1].trim();

const norm = (raw) => {
  let p = raw || '';
  if (p.startsWith('file://')) p = p.slice(7);
  try { p = decodeURIComponent(p); } catch (e) { /* raw */ }
  return p;
};
const objName = (f) => `music/${path.relative(HOME, f)}`;
const b64url = (b) => Buffer.from(b).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function token() {
  const now = Math.floor(Date.now() / 1000);
  const claim = {aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now,
    iss: key.client_email, scope: 'https://www.googleapis.com/auth/devstorage.read_write'};
  const unsigned = `${b64url(JSON.stringify({alg: 'RS256', typ: 'JWT'}))}.${b64url(JSON.stringify(claim))}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const res = await fetch('https://oauth2.googleapis.com/token', {method: 'POST',
    body: new URLSearchParams({assertion: `${unsigned}.${sig}`,
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer'})});
  return (await res.json()).access_token;
}

(async () => {
  const lib = JSON.parse(fs.readFileSync(`${D}/library.json`, 'utf8'));
  const man = JSON.parse(fs.readFileSync(`${D}/music-backup-manifest.json`, 'utf8'));
  const first = (ids, look) => (ids && ids.length && look[ids[0]] && look[ids[0]].name) || '';
  const seen = new Set(), tracks = [];
  for (const [id, t] of Object.entries(lib.tracks)) {
    const fp = norm(t.filePath || ''); if (!fp) continue;
    const object = objName(fp);
    if (!man[object] || seen.has(object)) continue;
    seen.add(object);
    tracks.push({album: first(t.albumIds, lib.albums), artist: first(t.artistIds, lib.artists),
      duration: t.duration || 0, id: t.id || id, name: t.name || '', object, year: t.year || 0});
  }
  const catalog = {count: tracks.length, generatedAt: new Date().toISOString(), tracks};
  const name = `catalog/${catalog.generatedAt.replace(/[:.]/g, '-')}.json`;
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(BUCKET)}` +
    `/o?uploadType=media&name=${encodeURIComponent(name)}`;
  const res = await fetch(url, {method: 'POST', body: JSON.stringify(catalog),
    headers: {Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json'}});
  console.log(res.ok ? `published ${name} with ${catalog.count} tracks`
    : `FAILED ${res.status}: ${(await res.text()).slice(0, 200)}`);
})();
