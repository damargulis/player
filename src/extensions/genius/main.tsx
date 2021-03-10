import {
  Artist,
  LibraryInfo,
  Track,
  TrackInfo
} from '../../redux/actionTypes';
import {ipcRenderer} from 'electron';
import PromisePool from 'es6-promise-pool';
import rp from 'request-promise-native';
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
// TODO: don't put in source code lol
const ACCESS_TOKEN = 'I2ff7nUpgZRm7Ef5Q0KUYG8Y5OUcATEkROCoq2xd3GMyjlH4Vs0JzDQ3pQrhEDZe';

interface Result {
  id: string;
  info: TrackInfo;
}

function geniusRequest(url: string): Promise<string> {
  const options = {
    uri: url,
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
  };
  return rp(options);
}

function searchForTrackId(store: RootState, track: Track): Promise<string | undefined> {
  const primaryArtist = getArtistById(store, track.artistIds[0]);
  // TODO: remove periods and other puncutation from search url?
  return geniusRequest(SEARCH_URL + encodeURIComponent(`${track.name} ${primaryArtist.name}`)).then(
      (jsonString: string) => {
    const results = JSON.parse(jsonString);
    const result = results.response.hits.find((hit: {result: {title: string; primary_artist: {name: string}}}) => {
      const title = hit.result.title.toLowerCase().replace('’', '\'');
      const artist = hit.result.primary_artist.name.toLowerCase().replace('’', '\'');
      return title === track.name.toLowerCase() && artist === primaryArtist.name.toLowerCase();
    });
    return result && result.result.id;
  }).catch(() => {});
}

function modifyTrack(store: RootState, track: Track, geniusId: string): Promise<Result> {
  return geniusRequest(TRACK_URL + geniusId).then((jsonString: string) => {
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
