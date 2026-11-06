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
import {findMatch, MATCHER_VERSION} from './match';
import {
  getArtistById,
  getArtistsByIds,
  getTracksByIds,
} from '../../redux/selectors';
import shortid from 'shortid';
import {RootState} from '../../redux/store';
import {getPool} from '../utils';

const BASE_URL = 'https://api.genius.com/';
const SEARCH_URL = `${BASE_URL}search?q=`;
const TRACK_URL = `${BASE_URL}songs/`;

interface Result {
  id: string;
  info: TrackInfo;
  /** True when a settled miss meant no request was made, so the summary can say so. */
  skipped?: boolean;
}

interface SearchHit {
  result: {id: string; title: string; primary_artist: {name: string}};
}

function searchForTrackId(store: RootState, track: Track): Promise<string | undefined> {
  const primaryArtist = getArtistById(store, track.artistIds[0]);
  return geniusJson(SEARCH_URL + encodeURIComponent(`${track.name} ${primaryArtist.name}`))
    .then((results) => {
      const response = results.response as {hits?: SearchHit[]} | undefined;
      const hits = (response && response.hits) || [];
      // Matching lives in ./match, which is where the reasoning and the measurements are.
      const match = findMatch(
        hits.map((hit) => ({
          artist: hit.result.primary_artist.name,
          id: hit.result.id,
          title: hit.result.title,
        })),
        track.name,
        primaryArtist.name,
      );
      return match && match.id;
    });
}

/** Records that a search ran and matched nothing, so a later run can tell that apart. */
function missed(track: Track): Result {
  return {id: track.id, info: {genius: {errors: [], id: '', missedBy: MATCHER_VERSION, page: ''}}};
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
  // Already linked: re-resolve by id, which is one cheap call and keeps the url current.
  if (track.genius && track.genius.id) {
    return modifyTrack(store, track, track.genius.id)
      .catch(() => ({id: track.id, info: {}}));
  }
  // Searched before by this same matcher and found nothing. Asking again spends a request to
  // learn what we already know — and the hourly quota is the binding constraint on a 21k
  // sweep. A newer MATCHER_VERSION makes this false, so better matching retries every miss.
  if (track.genius && track.genius.missedBy === MATCHER_VERSION) {
    return Promise.resolve({id: track.id, info: {}, skipped: true} as Result);
  }
  return searchForTrackId(store, track)
    .then((trackId) => trackId ? modifyTrack(store, track, trackId) : missed(track))
    // Every failure yields the same empty result — including a rate limit, which the client has
    // already recorded so later calls short-circuit. Crucially this is *not* a miss marker: a
    // throttled track has not been checked, and marking it would bake the outage into the
    // library. The difference shows up in the summary.
    .catch(() => ({id: track.id, info: {}}));
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

export default function runGeniusExtension(store: RootState, trackIds: string[],
                                           sharedId?: string): PromiseLike<LibraryInfo> {
  const extensionId = sharedId || shortid.generate();
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
  let skipped = 0;
  let newMisses = 0;
  const trackPool = getTrackPool(store, trackIds, extensionId);
  trackPool.addEventListener('fulfilled', (evt) => {
    const e = evt as unknown as {data: {result: Result}};
    const {result} = e.data;
    tracks[result.id] = result.info;
    if (result.skipped) {
      skipped++;
    } else if (result.info.genius && !result.info.genius.page) {
      newMisses++;
    }
  });
  return trackPool.start().then(() => {
    const tracksWithExt = Object.values(tracks).filter((track) => {
      return !!(track.genius && track.genius.page);
    }).length;
    // Saying so is the whole point: a throttled run used to look identical to one that simply
    // found nothing, so it would be re-run against the same wall.
    const limited = isRateLimited()
      ? `<br><b>Stopped early: Genius rate limit reached.</b><br>
         Tracks after that point were skipped, not checked.<br>
         Run it again in ${describeWait((rateLimitedUntil() - Date.now()) / 1000)} to continue.`
      : '';
    // Spelling out the three outcomes separately is the point: "N with a link" alone could not
    // distinguish a library Genius does not cover from a run that barely asked anything.
    const settled = skipped
      ? `<br>${skipped} skipped — already searched and not on Genius.`
      : '';
    const fresh = newMisses ? `<br>${newMisses} searched with no match.` : '';
    const checked = trackIds.length - skipped;
    const msg = `Genius Modifier Finished.<br>
      ${trackIds.length} Tracks considered, ${checked} checked.<br>
      ${tracksWithExt} with genius link.${fresh}${settled}${limited}\n
    `;
    ipcRenderer.send('extension-update', {
      msg,
      type: 'done',
      extensionId,
    });
    return {tracks};
  });
}
