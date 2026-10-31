import {DATA_DIR} from '../constants';
import DJPlaylist from '../playlist/DJPlaylist';
import fs from 'fs';

/**
 * Records every low-queue warning, so an intermittent one can be read after the fact.
 *
 * The DJ has twice reported being told the queue was empty shortly after filling it. The
 * counting is right (album tracks go into the same list `getUpcoming` reads, and no album in
 * the library has dangling track ids), the refill reads the live store, and nothing in the
 * path mutates the queue — so the cause is still unknown and guessing at it has already cost
 * one wrong diagnosis.
 *
 * This writes what was actually true at the moment of the warning. It is a diagnostic, not a
 * fix, and should come out once the cause is known.
 */

const LOG_FILE = () => `${DATA_DIR}/dj-refill-log.json`;

/** Enough to cover a few sessions; old entries are worth less than a bounded file. */
const MAX_ENTRIES = 60;

export interface RefillRecord {
  at: string;
  /** What `maybeRefill` saw, and therefore what the DJ was told. */
  remaining: number;
  currentTrackId?: string;
  /** The ids actually in the queue, to tell "miscounted" from "genuinely empty". */
  upcoming: string[];
  historyLength: number;
  current: number;
  upcomingLength: number;
  /** Seconds since the queue was last written, and how many tracks that write left. */
  secondsSinceWrite: number | null;
  lastWriteSize: number;
  /**
   * True when the queue was rewritten recently and is now empty anyway — the reported shape.
   * A record without this is an ordinary refill and can be ignored.
   */
  suspicious: boolean;
}

export function buildRecord(playlist: DJPlaylist, remaining: number,
                            currentTrackId?: string, now: number = Date.now()): RefillRecord {
  const write = playlist.lastWrite();
  const debug = playlist.debugState();
  const since = write.at ? (now - write.at) / 1000 : null;
  return Object.assign({
    at: new Date(now).toISOString(),
    currentTrackId,
    lastWriteSize: write.size,
    remaining,
    secondsSinceWrite: since,
    // the reported shape: filled a moment ago, empty now
    suspicious: remaining === 0 && write.size > 0 && since !== null && since < 180,
    upcoming: playlist.getUpcoming().slice(0, 25),
  }, debug);
}

export function recordRefill(playlist: DJPlaylist, remaining: number,
                             currentTrackId?: string): void {
  try {
    const record = buildRecord(playlist, remaining, currentTrackId);
    let existing: RefillRecord[] = [];
    try {
      existing = JSON.parse(fs.readFileSync(LOG_FILE(), 'utf8')) as RefillRecord[];
    } catch (err) {
      // first write
    }
    fs.writeFileSync(LOG_FILE(),
      JSON.stringify(existing.concat([record]).slice(-MAX_ENTRIES)), 'utf8');
    if (record.suspicious) {
      // tslint:disable-next-line no-console
      console.warn('DJ low-queue warning fired on an empty queue that was just filled:', record);
    }
  } catch (err) {
    // a diagnostic that throws would be worse than the bug it is chasing
  }
}
