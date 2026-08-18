import {
  Artist,
  LibraryInfo,
  Track,
  TrackInfo
} from '../../redux/actionTypes';
import {DATA_DIR} from '../../constants';
import {ipcRenderer} from 'electron';
import PromisePool from 'es6-promise-pool';
import fs from 'fs';
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
const TOKEN_KEY = 'GENIUS_ACCESS_TOKEN';

function readTokenFrom(filePath: string): string | undefined {
  try {
    const line = fs.readFileSync(filePath, 'utf8').split('\n')
      .find((envLine) => envLine.startsWith(`${TOKEN_KEY}=`));
    return line ? line.slice(TOKEN_KEY.length + 1).trim() : undefined;
  } catch (err) {
    return undefined;
  }
}

let cachedToken: string | undefined;

/** Reads the Genius API token from .env.local (dev) or DATA_DIR/.env (packaged). */
function getAccessToken(): string | undefined {
  if (cachedToken === undefined) {
    cachedToken = readTokenFrom('.env.local') || readTokenFrom('.env') ||
      readTokenFrom(`${DATA_DIR}/.env`) || '';
  }
  return cachedToken || undefined;
}

interface Result {
  id: string;
  info: TrackInfo;
}

function geniusRequest(url: string): Promise<Response> {
  return fetch(url, {headers: {Authorization: `Bearer ${getAccessToken()}`}});
}

function searchForTrackId(store: RootState, track: Track): Promise<string | undefined> {
  const primaryArtist = getArtistById(store, track.artistIds[0]);
  // TODO: remove periods and other puncutation from search url?
  return geniusRequest(SEARCH_URL + encodeURIComponent(`${track.name} ${primaryArtist.name}`))
    .then((res: Response) => res.text()).then((jsonString: string) => {
    const results = JSON.parse(jsonString);
    const result = results.response.hits.find((hit: {result: {title: string; primary_artist: {name: string}}}) => {
      // normalize both sides so curly apostrophes (from either Genius or
      // MusicBrainz-sourced library names) never break the match
      const title = normalizeQuotes(hit.result.title).toLowerCase();
      const artist = normalizeQuotes(hit.result.primary_artist.name).toLowerCase();
      return title === normalizeQuotes(track.name).toLowerCase() &&
        artist === normalizeQuotes(primaryArtist.name).toLowerCase();
    });
    return result && result.result.id;
  }).catch(() => {});
}

function modifyTrack(store: RootState, track: Track, geniusId: string): Promise<Result> {
  return geniusRequest(TRACK_URL + geniusId).then((res: Response) => res.text()).then((jsonString: string) => {
    const results = JSON.parse(jsonString);
    const url = results.response.song.url;
    return ({
      id: track.id,
      info: {
        genius: {
          id: geniusId,
          page: url,
          errors: [],
        },
      },
    });
  }).catch(() => ({id: track.id, info: {}}));
}

function modifyTrackRunner(store: RootState, track: Track): Promise<Result> {
  if (!track.genius) {
    return searchForTrackId(store, track).then((trackId) => {
      if (trackId) {
        return modifyTrack(store, track, trackId);
      }
      return Promise.resolve({id: track.id, info: {}});
    });
  }
  return modifyTrack(store, track, track.genius.id);
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
      msg: `Genius extension skipped: no ${TOKEN_KEY} found in .env.local or ${DATA_DIR}/.env`,
      type: 'done',
      extensionId,
    });
    return Promise.resolve({tracks: {}});
  }
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
    const msg = `Genius Modifier Finished.<br>
      ${trackIds.length} Tracks modified.<br>
      ${tracksWithExt} with genius link.\n
    `;
    ipcRenderer.send('extension-update', {
      msg,
      type: 'done',
      extensionId,
    });
    return {tracks};
  });
}
