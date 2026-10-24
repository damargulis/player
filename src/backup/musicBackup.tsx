import {DATA_DIR} from '../constants';
import fs from 'fs';
import {GcsError, isConfigured, setupHelp, uploadObject} from './gcs';
import os from 'os';
import path from 'path';

/**
 * Keeps the offsite copy of the actual audio files up to date.
 *
 * The bulk of this work belongs to `scripts/backup-music.js` — the first pass is ~163GB and
 * about a day of wall-clock, which has no business running inside a renderer that is also
 * playing music. What runs here is the steady state: every couple of weeks, notice the handful
 * of albums that have been added since last time and push just those.
 *
 * Both paths write the same manifest and name objects identically, so they are interchangeable:
 * whatever the script has already uploaded, this skips, and vice versa.
 */

const HOME = os.homedir();
const MANIFEST_FILE = () => `${DATA_DIR}/music-backup-manifest.json`;
const STATE_FILE = () => `${DATA_DIR}/music-backup-state.json`;
const LIBRARY_FILE = () => `${DATA_DIR}/library.json`;

/** Fortnightly. New music arrives in occasional batches, not continuously. */
export const MUSIC_BACKUP_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Ceilings for a single automatic run.
 *
 * At the ~2.3MB/s this connection manages, 4GB is roughly half an hour of background uploading,
 * which is a reasonable amount of someone's bandwidth to take without asking. Anything beyond
 * that is the initial import rather than a top-up, and belongs in the script — so a run that
 * hits a ceiling still uploads what it can and says what is left.
 */
export const MAX_FILES_PER_RUN = 400;
export const MAX_BYTES_PER_RUN = 4 * 1024 * 1024 * 1024;

/** Deliberately low: this runs behind playback and a possibly-active DJ session. */
const CONCURRENCY = 3;

/** Long enough that a launch-time sweep never competes with first paint. */
export const MUSIC_BACKUP_START_DELAY = 60 * 1000;

const CONTENT_TYPES: Record<string, string> = {
  '.aac': 'audio/aac',
  '.aiff': 'audio/aiff',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

export interface ManifestEntry {
  size: number;
  already?: boolean;
}

export type Manifest = Record<string, ManifestEntry>;

export interface MusicBackupState {
  lastRunAt?: number;
  lastSuccessAt?: number;
  lastUploaded?: number;
  lastBytes?: number;
  pendingAfterRun?: number;
  lastError?: string;
}

export function loadManifest(): Manifest {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_FILE(), 'utf8')) as Manifest;
  } catch (err) {
    return {};
  }
}

function saveManifest(manifest: Manifest): void {
  try {
    fs.writeFileSync(MANIFEST_FILE(), JSON.stringify(manifest), 'utf8');
  } catch (err) {
    // losing the bookkeeping only costs re-checking files that are already safely uploaded
  }
}

export function loadMusicState(): MusicBackupState {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE(), 'utf8')) as MusicBackupState;
  } catch (err) {
    return {};
  }
}

function saveMusicState(state: MusicBackupState): void {
  try {
    fs.writeFileSync(STATE_FILE(), JSON.stringify(state), 'utf8');
  } catch (err) {
    // same: bookkeeping only
  }
}

export function isMusicBackupDue(state: MusicBackupState, now: number = Date.now()): boolean {
  return !state.lastSuccessAt || now - state.lastSuccessAt >= MUSIC_BACKUP_INTERVAL_MS;
}

/** `music/<path relative to home>` — must stay byte-identical to the script's naming. */
export function objectNameForTrack(filePath: string): string {
  return `music/${path.relative(HOME, filePath)}`;
}

/** iTunes writes `file://` URLs with percent-escapes; the filesystem wants neither. */
export function normalizeTrackPath(raw: string): string {
  let p = raw || '';
  if (p.startsWith('file://')) {
    p = p.slice(7);
  }
  try {
    p = decodeURIComponent(p);
  } catch (err) {
    // a stray % that is not an escape; the raw path is the best guess
  }
  return p;
}

/** Every distinct audio file the library points at, in library order. */
export function trackPaths(): string[] {
  const library = JSON.parse(fs.readFileSync(LIBRARY_FILE(), 'utf8')) as {
    tracks?: Record<string, {filePath?: string}>;
  };
  const seen: Record<string, boolean> = {};
  const out: string[] = [];
  Object.keys(library.tracks || {}).forEach((id) => {
    const p = normalizeTrackPath((library.tracks || {})[id].filePath || '');
    if (p && !seen[p]) {
      seen[p] = true;
      out.push(p);
    }
  });
  return out;
}

export interface PendingFile {
  path: string;
  name: string;
  size: number;
}

/**
 * Files the library knows about that the bucket does not have yet.
 *
 * A file whose size no longer matches the manifest counts as pending: that is a re-tag or a
 * re-rip, and the new bytes are worth keeping. Files that have vanished from disk are skipped
 * rather than reported — the library outlives the odd moved folder.
 *
 * Asynchronous because there are 20,000-odd of these: the synchronous version blocks the
 * renderer for seconds, and the renderer is the thread playing the music.
 */
export async function pendingFiles(manifest: Manifest = loadManifest()): Promise<PendingFile[]> {
  const out: PendingFile[] = [];
  for (const p of trackPaths()) {
    const name = objectNameForTrack(p);
    let size: number;
    try {
      size = (await fs.promises.stat(p)).size;
    } catch (err) {
      continue;
    }
    const done = manifest[name];
    if (!done || done.size !== size) {
      out.push({name, path: p, size});
    }
  }
  return out;
}

export interface MusicBackupOutcome {
  ok: boolean;
  skipped?: string;
  uploaded: number;
  bytes: number;
  failed: number;
  /** Files still missing offsite after this run — non-zero means a ceiling was hit. */
  pending: number;
  error?: string;
}

/**
 * Uploads what is pending, up to the per-run ceilings. Never throws; the caller is a timer.
 *
 * Individual failures are counted rather than fatal: one unreadable file should not stop the
 * other 399, and the manifest is saved either way so the next run resumes rather than restarts.
 */
export async function runMusicBackup(
  options: {force?: boolean} = {},
): Promise<MusicBackupOutcome> {
  const empty = {bytes: 0, failed: 0, pending: 0, uploaded: 0};
  const state = loadMusicState();
  if (!isConfigured()) {
    return Object.assign({}, empty, {
      ok: false,
      skipped: `Cloud backup is not set up. ${setupHelp()}`,
    });
  }
  if (!options.force && !isMusicBackupDue(state)) {
    return Object.assign({}, empty, {ok: true, skipped: 'Music was backed up recently.'});
  }

  const now = Date.now();
  const manifest = loadManifest();
  let queue: PendingFile[];
  try {
    queue = await pendingFiles(manifest);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    saveMusicState(Object.assign({}, state, {lastError: message, lastRunAt: now}));
    return Object.assign({}, empty, {error: message, ok: false});
  }

  const totalPending = queue.length;
  let budget = MAX_BYTES_PER_RUN;
  const batch: PendingFile[] = [];
  queue.some((file) => {
    if (batch.length >= MAX_FILES_PER_RUN) {
      return true;
    }
    // an empty batch always takes the next file, however big: skipping it on every run would
    // stall that one file forever rather than just making this run a little longer
    if (file.size > budget && batch.length) {
      return false;
    }
    budget -= file.size;
    batch.push(file);
    return false;
  });

  let uploaded = 0;
  let bytes = 0;
  let failed = 0;
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < batch.length) {
      const file = batch[cursor];
      cursor += 1;
      try {
        const type = CONTENT_TYPES[path.extname(file.path).toLowerCase()] ||
          'application/octet-stream';
        await uploadObject(file.name, await fs.promises.readFile(file.path), type);
        manifest[file.name] = {size: file.size};
        uploaded += 1;
        bytes += file.size;
      } catch (err) {
        if (err instanceof GcsError && err.status === 403) {
          // already in the bucket from a run whose manifest entry was lost; the key cannot
          // replace an object, so a 403 here means the bytes are safe, not that we failed
          manifest[file.name] = {already: true, size: file.size};
          uploaded += 1;
        } else {
          failed += 1;
        }
      }
    }
  };

  const workers: Array<Promise<void>> = [];
  for (let i = 0; i < Math.min(CONCURRENCY, batch.length); i += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);
  saveManifest(manifest);

  const pending = totalPending - uploaded;
  saveMusicState({
    lastBytes: bytes,
    lastError: failed ? `${failed} file(s) failed to upload.` : undefined,
    lastRunAt: now,
    // A run that hit a ceiling has not caught up, so it must not reset the fortnightly clock:
    // leaving it where it was means the daily timer picks the work up again tomorrow and keeps
    // chipping away, and only a run that clears the backlog drops back to the 14-day cadence.
    lastSuccessAt: pending > 0 ? state.lastSuccessAt : now,
    lastUploaded: uploaded,
    pendingAfterRun: pending,
  });
  return {bytes, failed, ok: failed === 0, pending, uploaded};
}
