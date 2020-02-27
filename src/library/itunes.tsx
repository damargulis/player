import { Album, Artist, Genre, LibraryState, Playlist, Track} from '../redux/actionTypes';
import {DATA_DIR} from '../constants';
import {remote} from 'electron';
import fs from 'fs';
import mm from 'musicmetadata';
import plist from 'plist';
import shortid from 'shortid';
import {combineArray, upLevels} from './utils';

interface ItunesPlaylistData {
  'Playlist Items': Array<{'Track ID': number}>;
  Name: string;
  'Smart Criteria': string;
  'Distinguished Kind': number;
}

interface ItunesTrackData {
  'Track ID': number;
  'Date Added': string;
  'Total Time': number;
  Location: string;
  Comments: string;
  Album: string;
  Artist: string;
  Name: string;
  'Play Count': number;
  'Play Date UTC': string;
  'Skip Count': number;
  'Track Number': number;
  Year: number;
}

interface ItunesData {
  Tracks: Record<string, ItunesTrackData>;
  Playlists: ItunesPlaylistData[];
}

function createDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
  }
}

function selectItunesFile(): string | undefined {
  alert('Select the iTunes manifest file to load library.');
  const response = remote.dialog.showOpenDialogSync({properties: ['openFile']});
  return response && response[0];
}

function getArtists(data: ItunesData, albums: Record<string, Album>, tracks: Record<string, Track>)
  : Record<string, Artist> {
  const artists = {} as Record<string, Artist>;
  const artistsByLocation = new Map();
  let id = 0;
  const [compilations, otherAlbums] = Object.values(albums).reduce(([comps, others], album) => {
    const trackData = data.Tracks[album.trackIds[0]];
    const location = upLevels(trackData.Location, 2);
    if (location.slice(-12) === 'Compilations') {
      comps.push(album);
    } else {
      others.push(album);
    }
    return [comps, others];
  }, [[], []] as Album[][]);
  Object.values(otherAlbums).forEach((album) => {
    const trackData = data.Tracks[album.trackIds[0]];
    const location = upLevels(trackData.Location, 2);
    let artist = {} as Artist;
    if (artistsByLocation.has(location)) {
      artist = artistsByLocation.get(location);
      artist.trackIds = combineArray(artist.trackIds, album.trackIds);
      artist.genreIds = combineArray(artist.genreIds, album.genreIds);
      artist.albumIds.push(album.id);
    } else {
      const artistId = (id++).toString();
      artist = {
        id: artistId,
        name: trackData.Artist,
        albumIds: [album.id],
        errors: [],
        genreIds: [...album.genreIds],
        trackIds: [...album.trackIds],
      };
      artistsByLocation.set(location, artist);
    }
    album.artistIds = combineArray(album.artistIds, [artist.id]);
    album.trackIds.forEach((trackId) => {
      const track = tracks[trackId];
      track.artistIds = combineArray(track.artistIds, [artist.id]);
    });
  });
  artistsByLocation.forEach((artist) => {
    artists[artist.id] = artist;
  });
  const artistsByName = {} as Record<string, Artist>;
  [...artistsByLocation].forEach(([location, artist]) => {
    artistsByName[artist.name] = artist;
  });
  Object.values(compilations).forEach((album) => {
    album.trackIds.forEach((trackId) => {
      const track = tracks[trackId];
      const trackData = data.Tracks[trackId];
      let artist = artistsByName[trackData.Artist];
      if (!artist) {
        const artistId = (id++).toString();
        artist = {
          id: artistId,
          name: trackData.Artist,
          albumIds: [],
          errors: [],
          genreIds: [],
          trackIds: [],
        };
        artists[artist.id] = artist;
        artistsByName[artist.name] = artist;
      }
      artist.trackIds = combineArray(artist.trackIds, [track.id]);
      artist.genreIds = combineArray(artist.genreIds, [...track.genreIds]);
      track.artistIds = combineArray(track.artistIds, [artist.id]);
    });
  });
  return artists;
}

function getAlbums(tracks: Record<string, Track>, data: ItunesData): Record<string, Album> {
  const albums = {} as Record<string, Album>;
  const albumsByLocation = new Map();
  let id = 0;
  Object.values(tracks).forEach((track) => {
    const trackData = data.Tracks[track.id];
    const location = upLevels(trackData.Location, 1);
    if (albumsByLocation.has(location)) {
      const album = albumsByLocation.get(location);
      album.trackIds.push(track.id);
      album.genreIds = combineArray(album.genreIds, track.genreIds);
      track.albumIds = [album.id];
    } else {
      const albumId = (id++).toString() as string;
      albumsByLocation.set(location, {
        id: albumId,
        warnings: {},
        errors: [],
        albumArtFile: '',
        artistIds: [],
        name: trackData.Album,
        trackIds: [track.id],
        year: track.year,
        genreIds: [...track.genreIds],
        playCount: 0,
        skipCount: 0,
        favorites: [],
      });
      track.albumIds = [albumId];
    }
  });
  albumsByLocation.forEach((album) => {
    albums[album.id] = album;
  });
  Object.values(albums).forEach((album) => {
    album.trackIds.sort((trackId1, trackId2) => {
      const track1 = data.Tracks[trackId1];
      const track2 = data.Tracks[trackId2];
      return track1['Track Number'] - track2['Track Number'];
    });
  });
  return albums;
}

/**
 * Gets the genres for a single itunes track. Genres are expected to be in the
 * "Comments" attribution, formatted as a comma separated, quoted list.
 * i.e. "Rock", "Indie Rock", "Folk Rock"
 */
function getGenresFromTrack(trackData: {Comments: string}): string[] {
  return trackData.Comments.split(', ').map((genre) => genre.slice(1, -1));
}

function getGenres(data: ItunesData): Record<string, Genre> {
  const genreSet = new Set() as Set<string>;
  Object.values(data.Tracks).forEach((track) => {
    getGenresFromTrack(track).forEach((genre) => genreSet.add(genre));
  });
  const genres = {} as Record<string, Genre>;
  let id = 0;
  genreSet.forEach((genre) => {
    genres[(id++).toString()] = {name: genre};
  });
  return genres;
}

function getPlaylists(data: ItunesData): Record<string, Playlist> {
  const playlists = {} as Record<string, Playlist>;
  let id = 0;
  data.Playlists.filter((playlist) => {
    return !(playlist.Name === 'Library' || playlist['Smart Criteria'] || playlist['Distinguished Kind'])
      && playlist['Playlist Items'];
  }).forEach((playlist) => {
    const trackIds = playlist['Playlist Items']
      .filter((track: {'Track ID': number}) => !!track['Track ID'])
      .map((track: {'Track ID': number}) => track['Track ID'].toString());
    playlists[(id++).toString()] = {name: playlist.Name, trackIds};
  });
  return playlists;
}

function getTracks(data: ItunesData, genres: Record<string, string>): Record<string, Track> {
  const tracks = {} as Record<string, Track>;
  Object.keys(data.Tracks).forEach((trackId) => {
    const track = data.Tracks[trackId];
    const genreIds = getGenresFromTrack(track).map((genre) => genres[genre]);
    tracks[trackId.toString()] = {
      id: trackId,
      duration: track['Total Time'] || 0,
      playCount: track['Play Count'] || 0,
      playDate: new Date(track['Play Date UTC']),
      filePath: track.Location || '',
      artistIds: [],
      albumIds: [],
      name: track.Name || '',
      year: track.Year || 0,
      genreIds: genreIds,
      skipCount: track['Skip Count'] || 0,
      dateAdded: new Date(track['Date Added']),
      favorites: [],
    };
  });
  return tracks;
}

function parseItunesFile(file: string): ItunesData {
  const data = fs.readFileSync(file);
  const xmlData = data.toString().replace(/[\n\t\r]/g, '');
  return plist.parse(xmlData) as unknown as ItunesData;
}

/**
 * Gets the album art from an mp3 file. Saves the the art into its own file and
 * returns a promise with the file path.
 */
function getAlbumArt(filePath: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    filePath = decodeURI(filePath.slice(7)).replace('%23', '#');
    try {
      const readStream = fs.createReadStream(filePath);
      mm(readStream, (err: Error | undefined, data: {picture: Array<{data: Buffer}>}) => {
        const id = shortid.generate();
        if (err) {
          return;
        }
        if (data.picture[0] && data.picture[0].data) {
          fs.writeFileSync(`${DATA_DIR}/${id}.png`, data.picture[0].data);
        } else {
          resolve();
        }
        readStream.close();
        resolve(`${DATA_DIR}/${id}.png`);
      });
    } catch (err) {
      resolve();
    }
  });
}

function inverse(record: Record<string, Genre>): Record<string, string> {
  const ret = {} as Record<string, string>;
  Object.keys(record).forEach((key) => {
    const newKey = record[key];
    ret[newKey.name] = key;
  });
  return ret;
}

export function createLibrary(): Promise<LibraryState> {
  return new Promise((resolve) => {
    createDir();
    const itunesFile = selectItunesFile();
    if (!itunesFile) {
      alert('No file selected');
      return resolve({tracks: {}, albums: {}, playlists: {}, artists: {}, genres: {}});
    }
    const parsedItunesData = parseItunesFile(itunesFile);
    const genres = getGenres(parsedItunesData);
    const genresInverse = inverse(genres);
    const tracks = getTracks(parsedItunesData, genresInverse);
    const albums = getAlbums(tracks, parsedItunesData);
    const artists = getArtists(parsedItunesData, albums, tracks);
    const playlists = getPlaylists(parsedItunesData);
    const promises = Object.values(albums).map((album) => {
      // TODO: check all tracks until an art is found?
      const track = tracks[album.trackIds[0]];
      return getAlbumArt(track.filePath).then((artPath) => {
        album.albumArtFile = artPath;
      });
    });
    return Promise.all(promises).then(() => resolve({tracks, albums, artists, genres, playlists}));
  });
}
