import {LibraryState} from '../redux/actionTypes';
import {atomicSave} from '../library/atomicSave';
import {DATA_DIR} from '../constants';
import DJPlaylist from './DJPlaylist';
import EmptyPlaylist from './EmptyPlaylist';
import fs from 'fs';
import RandomAlbumPlaylist from './RandomAlbumPlaylist';
import RandomTrackPlaylist from './RandomTrackPlaylist';
import {SavedPlayback} from './savedQueue';

/**
 * Remembers the queue and the position in it across restarts.
 *
 * Written whenever the track, the queue or play/pause changes, at most every `POSITION_EVERY_MS`
 * for the position alone (`timeupdate` fires four times a second), and synchronously on quit.
 * `queue.json`, not `library.json`: this changes constantly and is worth nothing in a backup.
 */
const QUEUE_FILE = () => `${DATA_DIR}/queue.json`;
const POSITION_EVERY_MS = 10 * 1000;

export function loadSavedPlayback(): SavedPlayback | undefined {
  try {
    const saved = JSON.parse(fs.readFileSync(QUEUE_FILE(), 'utf8')) as SavedPlayback;
    return saved && saved.queue ? saved : undefined;
  } catch (err) {
    return undefined;
  }
}

/** The saved queue rebuilt against the library as it is now, or undefined to start fresh. */
export function restorePlaylist(saved: SavedPlayback | undefined, library: LibraryState): EmptyPlaylist | undefined {
  if (!saved) {
    return undefined;
  }
  const queue = saved.queue;
  switch (queue.kind) {
  case 'album':
    return RandomAlbumPlaylist.fromSaved(queue, library.albums);
  case 'track':
    return RandomTrackPlaylist.fromSaved(queue, library.tracks);
  case 'dj':
    return DJPlaylist.fromSaved(queue, (id) => !!library.tracks[id]);
  default:
    return undefined;
  }
}

export function snapshot(playlist: EmptyPlaylist, time: number, now: number = Date.now()): SavedPlayback | undefined {
  const queue = playlist.save();
  return queue && {queue, savedAt: now, time};
}

interface Watched {
  getState(): {currentlyPlaying: {playlist: EmptyPlaylist; currentlyPlayingId?: string; isPlaying: boolean;
    queueVersion: number; time: number; }; };
  subscribe(listener: () => void): () => void;
}

/** Starts saving; returns the function that stops it. */
export function persistQueue(store: Watched): () => void {
  let last = store.getState().currentlyPlaying;
  let lastSavedAt = 0;
  const write = (sync: boolean): void => {
    const playing = store.getState().currentlyPlaying;
    const saved = snapshot(playing.playlist, playing.time);
    if (!saved) {
      return;
    }
    lastSavedAt = Date.now();
    const contents = JSON.stringify(saved);
    if (sync) {
      // on quit there is no later tick to finish an async write in
      try {
        fs.writeFileSync(`${QUEUE_FILE()}.tmp`, contents);
        fs.renameSync(`${QUEUE_FILE()}.tmp`, QUEUE_FILE());
      } catch (err) {
        // a lost position is not worth interrupting a quit over
      }
      return;
    }
    atomicSave(QUEUE_FILE(), contents).catch(() => undefined);
  };
  const unsubscribe = store.subscribe(() => {
    const now = store.getState().currentlyPlaying;
    const changed = now.playlist !== last.playlist || now.currentlyPlayingId !== last.currentlyPlayingId ||
      now.queueVersion !== last.queueVersion || now.isPlaying !== last.isPlaying;
    const moved = now.time !== last.time;
    last = now;
    if (changed || (moved && Date.now() - lastSavedAt >= POSITION_EVERY_MS)) {
      write(false);
    }
  });
  const onQuit = () => write(true);
  window.addEventListener('beforeunload', onQuit);
  return () => {
    unsubscribe();
    window.removeEventListener('beforeunload', onQuit);
  };
}
