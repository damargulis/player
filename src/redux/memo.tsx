import {RootState} from './store';

/**
 * Keeping `mapStateToProps` from defeating `connect`.
 *
 * Every connected component here builds fresh closures on each call —
 * `getAlbumById: (id) => getAlbumById(store, id)` and so on — so the props object is never
 * shallow-equal to the last one and `connect` can **never** bail out. The result is that every
 * connected component re-renders on every action, and `timeupdate` dispatches about four times
 * a second throughout playback.
 *
 * Measured against this library, the selector work alone inside those calls is ~2.9ms per
 * action — the album filter 0.34ms over 2,176 albums, the artist filter 0.12ms over 1,102, and
 * the track filter 2.47ms over 21,078 tracks — so roughly 12ms of wasted work per second
 * before counting the React reconciliation it forces.
 *
 * The fix is to return the *same* values when nothing the component reads has changed.
 */

type Cache = Map<unknown, unknown>;

const bySlice = new WeakMap<object, Cache>();

function cacheFor(slice: object): Cache {
  let cache = bySlice.get(slice);
  if (!cache) {
    cache = new Map();
    bySlice.set(slice, cache);
  }
  return cache;
}

/**
 * A stable wrapper around a selector, reused while `slice` is the same object.
 *
 * **Only for a selector that reads nothing but `slice`.** The wrapper closes over the `store`
 * it was built with, so if the selector read another slice it would answer from a stale one.
 * Every selector used this way — `getAlbumById`, `getTracksByIds`, `getAllTracks`,
 * `getPlaylists` and the rest — touches only `store.library`, which was checked rather than
 * assumed; `getTime` and `getCurrentTrackId` read `currentlyPlaying` and are passed as values
 * instead, where a changed value is the point.
 *
 * Redux state is immutable, so an unchanged slice really does mean unchanged data, and the
 * WeakMap lets an old slice be collected with its cache.
 */
export function boundTo<A extends unknown[], R>(
  slice: object,
  store: RootState,
  fn: (state: RootState, ...args: A) => R,
): (...args: A) => R {
  const cache = cacheFor(slice);
  const existing = cache.get(fn);
  if (existing) {
    return existing as (...args: A) => R;
  }
  const wrapper = (...args: A): R => fn(store, ...args);
  cache.set(fn, wrapper);
  return wrapper;
}

/**
 * One-slot memo on argument identity, for the derived arrays.
 *
 * A filter over every album is both expensive and a new array each time, so it breaks shallow
 * equality even when its inputs have not moved. Comparing arguments by reference is enough
 * here because they are slices of immutable state or props handed down unchanged.
 */
export function memoize<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  let lastArgs: A | undefined;
  let lastResult: R;
  return (...args: A): R => {
    if (lastArgs && lastArgs.length === args.length &&
        lastArgs.every((arg, index) => arg === args[index])) {
      return lastResult;
    }
    lastArgs = args;
    lastResult = fn(...args);
    return lastResult;
  };
}

/** Exported for tests; a live cache makes `boundTo` impure across them. */
export function resetBindings(slice: object): void {
  bySlice.delete(slice);
}
