import {getAlbumsByIds, getArtistsByIds} from '../../redux/selectors';
import {ipcRenderer} from 'electron';
import {getPool} from '../utils';
import shortid from 'shortid';
import {RootState} from '../../redux/store';
import {Artist, ArtistInfo, LibraryInfo} from '../../redux/actionTypes';

// TODO: dynamically get location, make distance an option
const BASE_URL = "https://api.songkick.com/api/3.0";
const MAX_MILES = 50;

function deg2rad(deg: number) {
  return deg * (Math.PI/180)
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  return d;
}

interface SongkickResponse {
  resultsPage: {
    results: {
      artist: {
        displayName: string,
        id: string,
      }[]
      event: {
        location: {
          lng: number,
          lat: number,
        }
        displayName: string,
        id: string,
        start: {
          date: string;
        }
        uri: string;
      }[]
    };
  };
}

function searchForSongkickId(artist: Artist) {
  const url = `${BASE_URL}/search/artists.json?apikey=${(window as any).customEnv.SONGKICK_API_KEY}&query=${artist.name}`;
  return fetch(url).then((res: Response) => res.json()).then((res: SongkickResponse) => {
    console.log("Got:");
    console.log(res);
    if (!res.resultsPage.results.artist) {
      return;
    }
    const match = res.resultsPage.results.artist.find((a) => {
      return a.displayName.toLowerCase() === artist.name.toLowerCase();
    });
    return match && match.id;
  });
}

function runArtistModifier(store: RootState, artist: Artist) {
  console.log("RUNNIN!");
  console.log((window as any).customEnv);
  if (!artist.songkickId) {
    return Promise.resolve();
  }
  const url = `${BASE_URL}/artists/${artist.songkickId}/calendar.json?apikey=${(window as any).customEnv.SONGKICK_API_KEY}`;
  return fetch(url).then((res: Response) => res.json()).then((res: SongkickResponse) => {
    if (!res.resultsPage.results.event) {
      return;
    }
    const events = res.resultsPage.results.event.filter((event) => {
      console.log(event.displayName);
      const distanceKm = getDistanceFromLatLonInKm(event.location.lat, event.location.lng, (window as any).customEnv.MY_LAT, (window as any).customEnv.MY_LONG);
      const distanceMiles = distanceKm * 0.62137;
      console.log(distanceMiles);
      return distanceMiles <= MAX_MILES;
    });
    artist.events = events;
  });
}

function modifyArtist(store: RootState, artist: Artist): Promise<ArtistInfo> {
  if (!artist.songkickId) {
    return searchForSongkickId(artist).then((songkickId) => {
      if (songkickId) {
        artist.songkickId = songkickId;
        return runArtistModifier(store, artist).then(() => {
          return {...artist};
        });
      }
      //addError(artist, NO_SONGKICK_ERROR);
      return Promise.resolve({});
    });
  }
  return runArtistModifier(store, artist).then(() => {
    return {...artist};
  });
};

export default function runSongkickExtension(artistIds: string[], store: RootState): PromiseLike<LibraryInfo> {
  const extId = shortid.generate();
  const artists = getArtistsByIds(store, artistIds);
  const pool = getPool(store, artists, /* prefix= */ 'artist-', (artist) => artist.name, modifyArtist, extId);
  const artistMap = artists.reduce((map, curr) => { map[curr.id] = curr; return map; }, {} as Record<string, Artist>);
  return pool.start().then(() => {
    const msg = `Songkick Extension Completed.`;
    // TODO: stats
    ipcRenderer.send('extension-update', {
      msg,
      type: 'done',
      extensionId: extId,
    });
  }).then(() => {
    return {
      artists: {...artistMap},
    };
  });
}
