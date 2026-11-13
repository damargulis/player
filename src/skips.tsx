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
 * Set when the next track change is a rewind rather than a skip.
 *
 * Abandoning a song to replay the previous one says nothing about the song, so going back is
 * not a skip. The track-change recorder in `App` cannot see the direction, so the two action
 * creators that go backwards say so — and they are the single funnel for every route that goes
 * back, which is why the marker lives there rather than at each button.
 *
 * Failing to set it would over-count a rewind as a skip, never lose a real one.
 */
let rewinding = false;

export function noteRewind(): void {
  rewinding = true;
}

/** True once, for the change the rewind causes. Exported for the tests. */
export function takeRewind(): boolean {
  const was = rewinding;
  rewinding = false;
  return was;
}

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

/**
 * The whole rule for one track change: skip, or not.
 *
 * Lives here rather than in `App` so it can be tested, and so there is one statement of what
 * counts. `App` supplies only the two things it alone knows — how far in the outgoing track
 * got, and whether `ended` fired — and this consumes the rewind marker, which is why that
 * marker does not need to be handled by the caller at all.
 */
export function recordTrackChange(
  previous: Track | undefined,
  heardMs: number,
  finishedNaturally: boolean,
): TrackInfo | undefined {
  const rewound = takeRewind();
  if (finishedNaturally || rewound) {
    return undefined;
  }
  return recordSkip(previous, heardMs);
}
