import {Album, Artist, LibraryInfo, Track, TrackInfo, UPDATE_LIBRARY} from '../../redux/actionTypes';
import {fetchLyrics} from './api';
import {ipcRenderer} from 'electron';
import PromisePool from 'es6-promise-pool';
import {getAlbumsByIds, getArtistsByIds, getTracksByIds} from '../../redux/selectors';
import shortid from 'shortid';
import {hasLyricsFile, isSynced, markerFromStoredFile, saveLyrics} from './store';
import reduxStore, {RootState} from '../../redux/store';
import {getPool} from '../utils';

/**
 * How many results to accumulate before committing them to the library.
 *
 * The markers used to land only when the whole pool finished, which on a nine-hour sweep meant
 * no `L` appeared all night — and closing the app first threw away every marker, leaving files
 * on disk that nothing pointed at. Committing in batches fixes both. It is a batch rather than
 * one-at-a-time because the library reducer writes the whole 12MB file on every update.
 */
const COMMIT_EVERY = 100;

/**
 * Fills in lyrics from LRCLIB, storing the text on disk and a marker on the track.
 *
 * Shaped like the Genius extension so both entry points come for free: the Extensions menu
 * runs it over the whole library, and the track list's right-click menu runs it over a
 * selection.
 *
 * A full sweep is long — roughly 2 requests per track at ~75/minute, so about nine hours for
 * 21,000 tracks. That is an overnight job by design; re-running is cheap because anything
 * already fetched is skipped.
 */

interface Result {
  id: string;
  info: TrackInfo;
}

function firstName(items: Array<{name: string}>): string {
  return items.length ? items[0].name : '';
}

function lookupTrack(store: RootState, track: Track): Promise<Result> {
  // Already stored: a re-run is for filling gaps, not re-fetching what worked.
  if (track.lyrics && (hasLyricsFile(track.id) || track.lyrics.instrumental)) {
    return Promise.resolve({id: track.id, info: {}});
  }
  // A file with no marker means an earlier run fetched it but was closed before its markers
  // were committed. The words are already here; rebuild the marker rather than spend a
  // request re-fetching them.
  const recovered = markerFromStoredFile(track.id);
  if (recovered) {
    return Promise.resolve({id: track.id, info: {lyrics: recovered}});
  }
  const artist = firstName(getArtistsByIds(store, track.artistIds) as Artist[]);
  const album = firstName(getAlbumsByIds(store, track.albumIds) as Album[]);
  if (!track.name || !artist) {
    return Promise.resolve({id: track.id, info: {}});
  }
  return fetchLyrics({album, artist, durationMs: track.duration, title: track.name})
    .then((found) => {
      if (!found) {
        return {id: track.id, info: {}};
      }
      if (found.instrumental) {
        return {
          id: track.id,
          info: {lyrics: {errors: [], fetchedAt: Date.now(), instrumental: true, synced: false}},
        };
      }
      // The synced text is preferred and stored as LRC; highlighting can be added later
      // without a second pass over the API.
      const text = found.synced || found.plain || '';
      if (!text.trim()) {
        return {id: track.id, info: {}};
      }
      saveLyrics(track.id, text);
      return {
        id: track.id,
        info: {lyrics: {errors: [], fetchedAt: Date.now(), synced: isSynced(text)}},
      };
    })
    .catch(() => ({id: track.id, info: {}}));
}

function getTrackPool(store: RootState, trackIds: string[], extensionId: string):
  PromisePool<Result | void> {
  const tracks = getTracksByIds(store, trackIds);
  return getPool(
    store,
    tracks,
    /* prefix= */ 'track-',
    (track) => {
      const artist = getArtistsByIds(store, track.artistIds)
        .map((artistData: Artist) => artistData.name).join(', ');
      return `${track.name} by: ${artist}`;
    },
    lookupTrack,
    extensionId,
  );
}

export default function runLyricsExtension(store: RootState, trackIds: string[]):
  PromiseLike<LibraryInfo> {
  const extensionId = shortid.generate();
  const tracks = {} as Record<string, TrackInfo>;
  let uncommitted = {} as Record<string, TrackInfo>;
  const commit = (): void => {
    const batch = uncommitted;
    uncommitted = {};
    if (Object.keys(batch).length) {
      reduxStore.dispatch({payload: {library: {tracks: batch}}, type: UPDATE_LIBRARY});
    }
  };
  const trackPool = getTrackPool(store, trackIds, extensionId);
  trackPool.addEventListener('fulfilled', (evt) => {
    const e = evt as unknown as {data: {result: Result}};
    tracks[e.data.result.id] = e.data.result.info;
    if (e.data.result.info.lyrics) {
      uncommitted[e.data.result.id] = e.data.result.info;
      if (Object.keys(uncommitted).length >= COMMIT_EVERY) {
        commit();
      }
    }
  });
  return trackPool.start().then(() => {
    commit();
    const found = Object.values(tracks).filter((track) => track.lyrics).length;
    const synced = Object.values(tracks)
      .filter((track) => track.lyrics && track.lyrics.synced).length;
    const msg = `Lyrics Finished.<br>
      ${trackIds.length} Tracks checked.<br>
      ${found} with lyrics (${synced} synced).<br>
      Re-run to retry the rest — LRCLIB is often briefly unavailable.\n
    `;
    ipcRenderer.send('extension-update', {extensionId, msg, type: 'done'});
    return {tracks};
  });
}
