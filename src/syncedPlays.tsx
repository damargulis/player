import {Track, TrackInfo} from './redux/actionTypes';
import {PlayEntry} from './eventLog';

/**
 * Reading the `plays=` payload a phone sends with `/start-sync`.
 *
 * Two shapes exist on the wire, and both have to work. The original is a bare map of
 * `{trackId: count}` — all a phone build before this change could produce, since `PlayTracker`
 * only kept counts. The second carries a timestamp per play, which is what makes a real
 * listening history possible: the desktop's play log can only be as good as what it is told,
 * and the phone is where the time is actually known.
 *
 * An older phone against a newer desktop keeps working because the map shape is still read. A
 * newer phone against an older desktop sends a shape that one ignores, which loses that sync's
 * plays rather than erroring — the reason this is a new shape rather than a changed one.
 */

export interface SyncedPlay {
  id: string;
  /** Epoch ms when it happened, or undefined when the phone could not say. */
  at?: number;
  count: number;
  /** Plays unless stated; a bare count map can only ever be plays. */
  type: 'play' | 'skip';
}

interface Payload {
  v?: number;
  plays?: Array<{i?: string; t?: number}>;
  /** Added in v3. An older payload simply has none, which is not an error.  */
  skips?: Array<{i?: string; t?: number}>;
  counts?: Record<string, number>;
}

function fromCounts(counts: Record<string, unknown>): SyncedPlay[] {
  return Object.keys(counts).reduce((plays, id) => {
    const count = Number(counts[id]);
    if (id && Number.isFinite(count) && count > 0) {
      plays.push({count, id, type: 'play'});
    }
    return plays;
  }, [] as SyncedPlay[]);
}

/** One timestamped list from the payload, skipping entries with no id or no usable time. */
function fromList(entries: Array<{i?: string; t?: number}> | undefined,
                  type: 'play' | 'skip'): SyncedPlay[] {
  return (entries || []).reduce((out, entry) => {
    const id = entry && entry.i;
    const at = entry && entry.t;
    if (typeof id === 'string' && id && typeof at === 'number' && at > 0) {
      out.push({at, count: 1, id, type});
    }
    return out;
  }, [] as SyncedPlay[]);
}

/**
 * Normalises either shape into one list.
 *
 * Timestamped plays stay individual rather than being folded into a count per track: two plays
 * of the same song hours apart are two facts, and collapsing them is exactly the information
 * the old protocol threw away.
 */
export function parseSyncedPlays(payload: unknown): SyncedPlay[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const body = payload as Payload & Record<string, unknown>;
  // `v` is the discriminator, not the presence of `plays`. Keying off `plays` read a payload
  // with nothing to report, `{v: 2}`, as a play of a track called "v" — and an empty sync is
  // the common case, so that phantom play would have landed on most syncs.
  const versioned = typeof body.v === 'number' || Array.isArray(body.plays) ||
    Array.isArray(body.skips) || !!body.counts;
  if (!versioned) {
    // the original shape: a bare {trackId: count} map
    return fromCounts(body as Record<string, unknown>);
  }
  const plays = fromList(body.plays, 'play').concat(fromList(body.skips, 'skip'));
  if (body.counts) {
    // plays a pre-timestamp build was still holding; no time to give them
    plays.push(...fromCounts(body.counts as Record<string, unknown>));
  }
  return plays;
}

/** Just one kind, for updating the counter that belongs to it. */
export function ofType(plays: SyncedPlay[], type: 'play' | 'skip'): SyncedPlay[] {
  return plays.filter((play) => play.type === type);
}

/** Total per track, which is what `Track.playCount` and `Track.skipCount` need. */
export function countsByTrack(plays: SyncedPlay[]): Record<string, number> {
  return plays.reduce((counts, play) => {
    counts[play.id] = (counts[play.id] || 0) + play.count;
    return counts;
  }, {} as Record<string, number>);
}

/** The most recent moment any of these plays happened, for `Track.playDate`. */
export function latestPlayedAt(plays: SyncedPlay[], trackId: string): number | undefined {
  return plays
    .filter((play) => play.id === trackId && play.at !== undefined)
    .reduce((latest, play) => Math.max(latest, play.at as number), 0) || undefined;
}

/**
 * Every track change one phone sync makes, as a single delta for `updateLibrary`.
 *
 * It used to be one `updateTrack` per track, and the library reducer stringifies and saves the
 * whole ~13MB library on every mutating action — ~30ms each, so a sync touching 150 tracks froze
 * the window for about five seconds. One delta is one save. Plays and skips for the same track
 * are merged here, since the second dispatch used to read the first one's result.
 */
export function syncedTrackUpdates(
  events: SyncedPlay[],
  getTrack: (id: string) => Track | undefined,
  syncedAt: number,
): Record<string, TrackInfo> {
  const updates: Record<string, TrackInfo> = {};
  const plays = ofType(events, 'play');
  const playCounts = countsByTrack(plays);
  Object.keys(playCounts).forEach((trackId) => {
    const track = getTrack(trackId);
    if (!track) {
      return;
    }
    const playedAt = latestPlayedAt(plays, trackId);
    updates[trackId] = {
      playCount: track.playCount + playCounts[trackId],
      // only move playDate forward: an old sync arriving late must not rewind it
      playDate: new Date(Math.max(playedAt || syncedAt, track.playDate ? track.playDate.getTime() : 0)),
    };
  });
  // the phone counts a skip the same way the desktop does, so they mean the same thing
  const skipCounts = countsByTrack(ofType(events, 'skip'));
  Object.keys(skipCounts).forEach((trackId) => {
    const track = getTrack(trackId);
    if (track) {
      updates[trackId] = {...updates[trackId], skipCount: (track.skipCount || 0) + skipCounts[trackId]};
    }
  });
  return updates;
}

/**
 * Drops the timed events this desktop has already applied, judged against its own play log.
 *
 * The phone keeps everything until a sync is acknowledged, so a sync whose reply was lost after
 * the desktop applied it is sent again. The log already holds each applied phone event with the
 * phone's own timestamp, so the same track, type and moment is the same event — no batch ids.
 * Untimed counts from old phone builds carry nothing to compare and always pass.
 */
export function notYetApplied(events: SyncedPlay[], log: PlayEntry[]): SyncedPlay[] {
  const seen = new Set<string>();
  log.forEach((entry) => {
    if (entry.source === 'phone' && !entry.estimated && (entry.type === 'play' || entry.type === 'skip')) {
      seen.add(`${entry.type}|${entry.id}|${entry.at}`);
    }
  });
  return events.filter((event) => event.at === undefined || !seen.has(`${event.type}|${event.id}|${event.at}`));
}
