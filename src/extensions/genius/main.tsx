import {
  Album,
  AlbumInfo,
  Artist,
  ArtistInfo,
  LibraryInfo,
  LibraryState,
  Track,
  TrackInfo
} from '../../redux/actionTypes';
import {ipcRenderer} from 'electron';
import {NOT_FOUND_ERROR} from './errors';
import PromisePool from 'es6-promise-pool';
import rp from 'request-promise-native';
import {
  getAlbumsByIds,
  getAllAlbumIds,
  getAllArtistIds,
  getAllTracks,
  getArtistById,
  getArtistsByIds,
  getTracksByIds
} from '../../redux/selectors';
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
  return geniusRequest(SEARCH_URL + track.name).then((jsonString: string) => {
    const results = JSON.parse(jsonString);
    const result = results.response.hits.find((hit: {result: {title: string; primary_artist: {name: string}}}) => {
      const title = hit.result.title;
      const artist = hit.result.primary_artist.name;
      return title === track.name && artist === primaryArtist.name;
    });
    return result && result.result.id;
  });
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
  });
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

function getTrackPool(store: RootState): PromisePool<Result | void> {
  const tracks = getAllTracks(store).slice(0, 20);
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
  );
}

export default function runGeniusExtension(store: RootState): PromiseLike<LibraryInfo> {
  const tracks = {} as Record<string, TrackInfo>;
  const trackPool = getTrackPool(store);
  trackPool.addEventListener('fulfilled', (evt) => {
    const e = evt as unknown as {data: {result: Result}};
    tracks[e.data.result.id] = e.data.result.info;
  });
  return trackPool.start().then(() => {
    ipcRenderer.send('extension-update', {
      type: 'done',
    });
  }).then(() => {
    return {tracks};
  });
}
