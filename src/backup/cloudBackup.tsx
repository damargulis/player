import {atomicSave} from '../library/atomicSave';
import {DATA_DIR} from '../constants';
import {externalEffectsAllowed} from '../devSafety';
import fs from 'fs';
import {GcsError, isConfigured, setupHelp, uploadObject} from './gcs';
import {getMemoryStore} from '../dj/memory';
import {alreadyExists} from './uploadRules';

/**
 * Offsite copy of the parts of this app that cannot be rebuilt.
 *
 * Only the irreplaceable things go: library.json (years of play counts, favourites, reactions
 * and hand-fixed metadata) and the DJ's memory notes. Art and thumbnails are deliberately left
 * out — the extensions refetch those, and they are 200x the bytes. Music is not handled here at
 * all; bulk sync belongs in a tool built for it.
 */

const STATE_FILE = () => `${DATA_DIR}/cloud-backup.json`;
const LIBRARY_FILE = () => `${DATA_DIR}/library.json`;

/** Daily, matching the local backup; each upload is ~12MB so this stays inside the free tier. */
export const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface CloudBackupState {
  lastRunAt?: number;
  lastSuccessAt?: number;
  lastObject?: string;
  lastTrackCount?: number;
  lastError?: string;
  /** `YYYY-MM` of the newest monthly snapshot uploaded. */
  lastMonthly?: string;
}

/**
 * Where the monthly snapshots go. The bucket's 180-day expiry rule is scoped to the prefixes
 * `library/` and `dj-memories/`, so a third prefix is outside it without touching the bucket.
 * Without these, backups that quietly stopped for six months would let every snapshot age out.
 */
export const MONTHLY_PREFIX = 'library-monthly';

export function monthKey(when: Date): string {
  return `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}`;
}

export function loadState(): CloudBackupState {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE(), 'utf8')) as CloudBackupState;
  } catch (err) {
    return {};
  }
}

function saveState(state: CloudBackupState): void {
  try {
    atomicSave(STATE_FILE(), JSON.stringify(state)).catch(() => undefined);
  } catch (err) {
    // losing the bookkeeping only costs us an extra upload
  }
}

export function isDue(state: CloudBackupState, now: number = Date.now()): boolean {
  return !state.lastSuccessAt || now - state.lastSuccessAt >= BACKUP_INTERVAL_MS;
}

/** Objects are timestamped because the service account cannot replace an existing name. */
export function objectNameFor(prefix: string, when: Date): string {
  return `${prefix}/${when.toISOString().replace(/[:.]/g, '-')}.json`;
}

export class BackupRefused extends Error {}

/**
 * Reads the library, refusing to ship something that looks broken.
 *
 * This app has already once written an empty library over a good one after a failed read. An
 * automatic backup that faithfully copies that upstream is worse than no backup at all, so an
 * empty library is never uploaded.
 */
export function readLibraryForBackup(): {contents: string; trackCount: number} {
  let contents: string;
  try {
    contents = fs.readFileSync(LIBRARY_FILE(), 'utf8');
  } catch (err) {
    throw new BackupRefused(`Could not read ${LIBRARY_FILE()}; nothing was uploaded.`);
  }
  let trackCount = 0;
  try {
    const parsed = JSON.parse(contents) as {tracks?: Record<string, unknown>};
    trackCount = Object.keys(parsed.tracks || {}).length;
  } catch (err) {
    throw new BackupRefused('The library file is not valid JSON; nothing was uploaded.');
  }
  if (!trackCount) {
    throw new BackupRefused('The library has no tracks, which means something upstream broke. ' +
      'Nothing was uploaded, so earlier backups are untouched.');
  }
  return {contents, trackCount};
}

/** The DJ's notes, bundled into one object so a handful of small files cost one upload. */
export function readMemoriesForBackup(): string | undefined {
  try {
    const files = getMemoryStore().listFiles();
    if (!files.length) {
      return undefined;
    }
    const bundle: Record<string, string> = {};
    files.forEach((file) => {
      bundle[file.path] = file.content;
    });
    return JSON.stringify(bundle);
  } catch (err) {
    return undefined;
  }
}

export interface BackupOutcome {
  ok: boolean;
  skipped?: string;
  uploaded?: string[];
  error?: string;
}

/** Runs a backup if one is due. Never throws; the caller is a timer. */
export async function runCloudBackup(options: {force?: boolean} = {}): Promise<BackupOutcome> {
  // a dev copy uploaded its own library to the real bucket; see devSafety.tsx
  if (!externalEffectsAllowed('backup')) {
    return {ok: true, skipped: 'Off in development; set MYMUSIC_DEV_EFFECTS=backup to test it.'};
  }
  const state = loadState();
  if (!isConfigured()) {
    return {ok: false, skipped: `Cloud backup is not set up. ${setupHelp()}`};
  }
  if (!options.force && !isDue(state)) {
    return {ok: true, skipped: 'Backed up recently.'};
  }
  const now = new Date();
  const uploaded: string[] = [];
  try {
    const library = readLibraryForBackup();
    const libraryObject = objectNameFor('library', now);
    await uploadObject(libraryObject, library.contents);
    uploaded.push(libraryObject);

    let lastMonthly = state.lastMonthly;
    const month = monthKey(now);
    if (lastMonthly !== month) {
      // timestamped, with "one a month" kept by `lastMonthly`: a bare `<month>.json` let the first
      // writer of the month own the name for good, and a dev copy's library took November's
      const monthlyObject = `${MONTHLY_PREFIX}/${month}_${now.toISOString().replace(/[:.]/g, '-')}.json`;
      try {
        await uploadObject(monthlyObject, library.contents, 'application/json', {ifAbsent: true});
        uploaded.push(monthlyObject);
      } catch (err) {
        // this month's is already there; anything else fails the run like any upload would
        if (!(err instanceof GcsError && alreadyExists(err.status, err.body))) {
          throw err;
        }
      }
      lastMonthly = month;
    }

    const memories = readMemoriesForBackup();
    if (memories) {
      const memoryObject = objectNameFor('dj-memories', now);
      await uploadObject(memoryObject, memories);
      uploaded.push(memoryObject);
    }
    saveState({
      lastError: undefined,
      lastMonthly,
      lastObject: libraryObject,
      lastRunAt: now.getTime(),
      lastSuccessAt: now.getTime(),
      lastTrackCount: library.trackCount,
    });
    return {ok: true, uploaded};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    saveState(Object.assign({}, state, {lastError: message, lastRunAt: now.getTime()}));
    return {error: message, ok: false, uploaded};
  }
}
