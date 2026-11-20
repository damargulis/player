/**
 * The playback queue as it is written to `DATA_DIR/queue.json`, so a restart comes back to the
 * same queue at the same spot. Everything is by id: entities are rebuilt from the library as it
 * is at launch, and anything that has since been deleted is dropped rather than restored as a
 * dangling id that would stop playback dead.
 */
export interface SavedAlbumQueue {
  kind: 'album';
  /** The albums played and queued so far, in order. */
  albumIds: string[];
  currentAlbum: number;
  /** By id rather than index, so an album whose tracks changed still finds its place. */
  currentTrackId?: string;
}

export interface SavedTrackQueue {
  kind: 'track';
  /** The shuffle so far. */
  trackIds: string[];
  current: number;
  /** What it was shuffling from, which may be a filtered list rather than the whole library. */
  poolIds: string[];
}

export interface SavedDJQueue {
  kind: 'dj';
  history: Array<{id: string; albumId?: string}>;
  current: number;
  upcoming: Array<{id: string; albumId?: string}>;
}

export type SavedQueue = SavedAlbumQueue | SavedTrackQueue | SavedDJQueue;

export interface SavedPlayback {
  queue: SavedQueue;
  /** Seconds into the current track. */
  time: number;
  savedAt: number;
}

/**
 * Keeps the items whose id still exists and moves `index` to where its item ended up. Returns
 * -1 for the index when the item it pointed at is gone.
 */
export function keepKnown<T>(items: T[], index: number, idOf: (item: T) => string,
                             exists: (id: string) => boolean): {items: T[]; index: number} {
  const kept: T[] = [];
  let moved = -1;
  items.forEach((item, i) => {
    if (exists(idOf(item))) {
      if (i === index) {
        moved = kept.length;
      }
      kept.push(item);
    }
  });
  return {index: moved, items: kept};
}
