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
  /** Epoch ms when it was heard, or undefined when the phone could not say. */
  at?: number;
  count: number;
}

interface PayloadV2 {
  v?: number;
  plays?: Array<{i?: string; t?: number}>;
  counts?: Record<string, number>;
}

function fromCounts(counts: Record<string, unknown>): SyncedPlay[] {
  return Object.keys(counts).reduce((plays, id) => {
    const count = Number(counts[id]);
    if (id && Number.isFinite(count) && count > 0) {
      plays.push({count, id});
    }
    return plays;
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
  const body = payload as PayloadV2 & Record<string, unknown>;
  // `v` is the discriminator, not the presence of `plays`. Keying off `plays` read a payload
  // with nothing to report, `{v: 2}`, as a play of a track called "v" — and an empty sync is
  // the common case, so that phantom play would have landed on most syncs.
  const versioned = typeof body.v === 'number' || Array.isArray(body.plays) || !!body.counts;
  if (!versioned) {
    // the original shape: a bare {trackId: count} map
    return fromCounts(body as Record<string, unknown>);
  }
  const plays: SyncedPlay[] = [];
  (body.plays || []).forEach((entry) => {
    const id = entry && entry.i;
    const at = entry && entry.t;
    if (typeof id === 'string' && id && typeof at === 'number' && at > 0) {
      plays.push({at, count: 1, id});
    }
  });
  if (body.counts) {
    // plays a pre-timestamp build was still holding; no time to give them
    plays.push(...fromCounts(body.counts as Record<string, unknown>));
  }
  return plays;
}

/** Total plays per track, which is what `Track.playCount` needs. */
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
