import {Track, TrackInfo} from './redux/actionTypes';
import {logPlays} from './eventLog';

/**
 * Recording that a track was skipped.
 *
 * `Track.skipCount` has been frozen since the iTunes import — `library/itunes.tsx` reads
 * "Skip Count" from the XML, and nothing in this app has incremented it since. So the 17,140
 * skips across 5,658 tracks are all history from another program, and the Stats page's "Most
 * Skipped" list has been showing the same answer for years.
 *
 * A skip is advancing away from a track that has not finished. The `ended` handler is the only
 * natural finish, so every other way forward is a skip: the transport buttons, the global
 * shortcuts, and either phone. Going *back* is not counted — abandoning a song to hear the
 * previous one again says nothing about the song.
 */

/** Under this, the listener barely heard it — a mis-click rather than a verdict. */
const MIN_HEARD_MS = 2000;

/**
 * The track update for a skip, or nothing when it should not count.
 *
 * Returns the delta rather than dispatching, so the caller stays the one that owns the store —
 * and both callers (the transport in `ControlPanel` and the remote handlers in `App`) apply it
 * the same way.
 */
export function recordSkip(track: Track | undefined, heardMs: number): TrackInfo | undefined {
  if (!track || heardMs < MIN_HEARD_MS) {
    return undefined;
  }
  logPlays([{at: Date.now(), id: track.id, source: 'desktop', type: 'skip'}]);
  return {skipCount: (track.skipCount || 0) + 1};
}
