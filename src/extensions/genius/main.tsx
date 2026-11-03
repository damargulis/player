import {
  Artist,
  LibraryInfo,
  Track,
  TrackInfo
} from '../../redux/actionTypes';
import {
  clearRateLimit,
  describeWait,
  geniusJson,
  getAccessToken,
  isRateLimited,
  rateLimitedUntil,
  tokenName,
} from './api';
import {DATA_DIR} from '../../constants';
import {ipcRenderer} from 'electron';
import PromisePool from 'es6-promise-pool';
import {
  getArtistById,
  getArtistsByIds,
  getTracksByIds,
} from '../../redux/selectors';
import shortid from 'shortid';
import {RootState} from '../../redux/store';
import {normalizeQuotes} from '../utils';
import {getPool} from '../utils';

const BASE_URL = 'https://api.genius.com/';
const SEARCH_URL = `${BASE_URL}search?q=`;
const TRACK_URL = `${BASE_URL}songs/`;

interface Result {
  id: string;
  info: TrackInfo;
}

interface SearchHit {
  result: {id: string; title: string; primary_artist: {name: string}};
}

function searchForTrackId(store: RootState, track: Track): Promise<string | undefined> {
  const primaryArtist = getArtistById(store, track.artistIds[0]);
  // TODO: remove periods and other puncutation from search url?
  return geniusJson(SEARCH_URL + encodeURIComponent(`${track.name} ${primaryArtist.name}`))
    .then((results) => {
      const response = results.response as {hits?: SearchHit[]} | undefined;
      const hits = (response && response.hits) || [];
      const result = hits.find((hit) => {
        // normalize both sides so curly apostrophes (from either Genius or
        // MusicBrainz-sourced library names) never break the match
        const title = normalizeQuotes(hit.result.title).toLowerCase();
        const artist = normalizeQuotes(hit.result.primary_artist.name).toLowerCase();
        return title === normalizeQuotes(track.name).toLowerCase() &&
          artist === normalizeQuotes(primaryArtist.name).toLowerCase();
      });
      return result && result.result.id;
    });
}

function modifyTrack(store: RootState, track: Track, geniusId: string): Promise<Result> {
  return geniusJson(TRACK_URL + geniusId).then((results) => {
    const response = results.response as {song?: {url?: string}} | undefined;
    const url = response && response.song && response.song.url;
    if (!url) {
      return {id: track.id, info: {}};
    }
    return {
      id: track.id,
      info: {genius: {errors: [], id: geniusId, page: url}},
    };
  });
}

/**
 * Looks one track up, turning any failure into "nothing found" — except a rate limit.
 *
 * A rate limit is recorded in the client so every later call short-circuits; the summary then
 * tells the listener when to resume. Everything else is genuinely per-track and should not
 * abandon the run.
 */
function modifyTrackRunner(store: RootState, track: Track): Promise<Result> {
  const lookup = track.genius
    ? modifyTrack(store, track, track.genius.id)
    : searchForTrackId(store, track).then((trackId) =>
      trackId ? modifyTrack(store, track, trackId) : {id: track.id, info: {}});
  // Every failure yields the same empty result here — including a rate limit, which the client
  // has already recorded so that later calls short-circuit without asking. The difference shows
  // up in the summary, not per track.
  return lookup.catch(() => ({id: track.id, info: {}}));
}

function getTrackPool(store: RootState, trackIds: string[], extensionId: string): PromisePool<Result | void> {
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
    modifyTrackRunner,
    extensionId,
  );
}

export default function runGeniusExtension(store: RootState, trackIds: string[]): PromiseLike<LibraryInfo> {
  const extensionId = shortid.generate();
  if (!getAccessToken()) {
    ipcRenderer.send('extension-update', {
      msg: `Genius extension skipped: no ${tokenName()} found in .env.local or ${DATA_DIR}/.env`,
      type: 'done',
      extensionId,
    });
    return Promise.resolve({tracks: {}});
  }
  // A limit from an earlier run has usually expired by the time someone runs it again.
  clearRateLimit();
  const tracks = {} as Record<string, TrackInfo>;
  const trackPool = getTrackPool(store, trackIds, extensionId);
  trackPool.addEventListener('fulfilled', (evt) => {
    const e = evt as unknown as {data: {result: Result}};
    tracks[e.data.result.id] = e.data.result.info;
  });
  return trackPool.start().then(() => {
    const tracksWithExt = Object.values(tracks).filter((track) => {
      return !!track.genius;
    }).length;
    // Saying so is the whole point: a throttled run used to look identical to one that simply
    // found nothing, so it would be re-run against the same wall.
    const limited = isRateLimited()
      ? `<br><b>Stopped early: Genius rate limit reached.</b><br>
         Tracks after that point were skipped, not checked.<br>
         Run it again in ${describeWait((rateLimitedUntil() - Date.now()) / 1000)} to continue.`
      : '';
    const msg = `Genius Modifier Finished.<br>
      ${trackIds.length} Tracks modified.<br>
      ${tracksWithExt} with genius link.${limited}\n
    `;
    ipcRenderer.send('extension-update', {
      msg,
      type: 'done',
      extensionId,
    });
    return {tracks};
  });
}
