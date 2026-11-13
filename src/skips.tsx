import {Album, AlbumInfo, Track, TrackInfo} from './redux/actionTypes';
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

/**
 * Set when the next track change is the listener stepping past a whole record.
 *
 * Skipping the rest of an album is a verdict on the album, not on each of its unheard tracks —
 * logging it per track would slowly fill "most skipped" with whatever happens to sit late on
 * records you often bail out of, songs you have never formed an opinion about. So this replaces
 * the track skip rather than adding to it: one album skip, and nothing against the track that
 * happened to be playing.
 *
 * Marked by the `nextAlbum` action creator, the single funnel for every route that does it.
 * A marker left unconsumed would downgrade a later track skip to an album one, which is the
 * same shape of risk the rewind marker carries and no worse.
 */
let skippingAlbum = false;

export function noteAlbumSkip(): void {
  skippingAlbum = true;
}

/** True once, for the change the album skip causes. Exported for the tests. */
export function takeAlbumSkip(): boolean {
  const was = skippingAlbum;
  skippingAlbum = false;
  return was;
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
 * Records that a whole album was rejected.
 *
 * `Album.skipCount` has existed since the iTunes import and nothing has ever incremented it —
 * 0 of 2,182 albums here carry one — so this is the first thing to write it. The log entry is
 * `subject: 'album'`, which it has always been able to express and nothing has ever used.
 */
export function recordAlbumSkip(album?: Album): AlbumInfo | undefined {
  if (!album) {
    return undefined;
  }
  logPlays([{at: Date.now(), id: album.id, source: 'desktop', subject: 'album', type: 'skip'}]);
  return {skipCount: (album.skipCount || 0) + 1};
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
export interface TrackChange {
  /** The update for the outgoing track, when the track itself was rejected. */
  track?: TrackInfo;
  /** The album to record instead, when the listener stepped past the whole record. */
  albumId?: string;
}

export function recordTrackChange(previous?: Track): TrackChange {
  const finished = naturallyFinished;
  naturallyFinished = undefined;
  const rewound = takeRewind();
  const album = takeAlbumSkip();
  if (!previous || rewound || finished === previous.id) {
    return {};
  }
  if (album) {
    // the album instead of the track: see noteAlbumSkip. albumIds[0] because that is the album
    // a track is shown under everywhere else in the app.
    const albumId = (previous.albumIds || [])[0];
    return albumId ? {albumId} : {};
  }
  return {track: recordSkip(previous)};
}

/**
 * Taking queued tracks out by hand counts as a skip too.
 *
 * It is the same judgement as pressing next, made a little earlier — arguably a stronger one,
 * since the listener rejected the track on sight rather than after hearing it. The DJ already
 * heard about removals through `session.noteListenerRemoval`, but that is in-memory and gone
 * when the session ends, so none of it reached the stats.
 *
 * Dropping a whole album logs each of its queued tracks, unlike the line the DJ is given, which
 * deliberately reports one rejection rather than a wall of tracks. Different purposes: the DJ
 * needs to know a record was refused, the skip list is per track.
 *
 * Counts duplicates: a queue can hold the same track twice, and removing both is two rejections.
 * One log write for the batch, and the deltas come back for the caller to dispatch together —
 * the library reducer rewrites the whole file per action, so an album should not cost twelve.
 */
export function recordRemovals(tracks: Track[]): Record<string, TrackInfo> {
  if (!tracks.length) {
    return {};
  }
  const at = Date.now();
  logPlays(tracks.map((track) => ({at, id: track.id, source: 'desktop' as const, type: 'skip' as const})));
  const updates = {} as Record<string, TrackInfo>;
  tracks.forEach((track) => {
    const alreadyCounted = updates[track.id];
    const from = alreadyCounted ? (alreadyCounted.skipCount || 0) : (track.skipCount || 0);
    updates[track.id] = {skipCount: from + 1};
  });
  return updates;
}
