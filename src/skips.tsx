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
 * shortcuts, either phone and the DJ. Going *back* is not counted — abandoning a song to hear
 * the previous one again says nothing about the song.
 *
 * There is deliberately no minimum listening time and no upper bound. A two-second floor used
 * to discard anything heard for less, on the theory that it was a mis-click rather than a
 * verdict, but it also discarded every quick rejection — and it made the feature impossible to
 * observe, since skipping through a few tracks to see it work recorded nothing at all. Leaving
 * a track late counts too: a skip is a skip however much of it you heard.
 */

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
export function recordSkip(track?: Track): TrackInfo | undefined {
  if (!track) {
    return undefined;
  }
  logPlays([{at: Date.now(), id: track.id, source: 'desktop', type: 'skip'}]);
  return {skipCount: (track.skipCount || 0) + 1};
}

/**
 * The track that reached its own end, so the change it causes is not a skip.
 *
 * Keyed on the id rather than a bare flag. `ended` dispatches a play-count update before it
 * advances, which replaces the track object, and anything watching object identity sees that as
 * a change — a boolean would be read and cleared by the wrong one, leaving the real change
 * looking like a skip. Naming the track means only that track's departure can be excused.
 */
let naturallyFinished: string | undefined;

export function noteNaturalFinish(trackId?: string): void {
  naturallyFinished = trackId;
}

/**
 * The whole rule for one track change: skip, or not.
 *
 * Lives here rather than in `App` so it can be tested, and so there is one statement of what
 * counts. `App` supplies only the two things it alone knows — how far in the outgoing track
 * got, and whether `ended` fired — and this consumes the rewind marker, which is why that
 * marker does not need to be handled by the caller at all.
 */
export function recordTrackChange(previous?: Track): TrackInfo | undefined {
  const finished = naturallyFinished;
  naturallyFinished = undefined;
  const rewound = takeRewind();
  if (!previous || rewound || finished === previous.id) {
    return undefined;
  }
  return recordSkip(previous);
}
