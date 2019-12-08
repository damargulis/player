import Album from './Album';
import Artist from './Artist';
import Library from './Library';
import Playlist from './Playlist';
import Track from './Track';

const fs = require('fs');
const path = require('path');
const shortid = require('shortid');
const {execSync} = require('child_process');

const mm = require('musicmetadata');

// TODO: redo this whole thing and just save the damn ids...

/**
 * Gets the genres for a single itunes track. Genres are expected to be in the
 * "Comments" attribution, formatted as a comma separated, quoted list.
 * i.e. "Rock", "Indie Rock", "Folk Rock"
 * @param {!Object} trackData The itunes track data.
 * @return {!Array<string>} An array of the genres for the track.
 */
function getGenres(trackData) {
  return trackData.Comments.split(', ').map(genre => genre.slice(1, -1));
}

/**
 * Returns the file path levels up from the path given.
 * @param {string} filePath The base file path.
 * @param {number=} levels The number of levels to go up, defaults to 1.
 * @return {string} The new path.
 */
function upLevels(filePath, levels = 1) {
  const parts = filePath.split(path.sep);
  const newparts = parts.slice(0, -1 * levels);
  return path.join(...newparts);
}

/**
 * Creates the artists data from itunes data.
 * @param {!Array<!Object>} tracks The itunes tracks.
 * @return {!Map<string,!Object>} A map from the filepath of the artist folder
 *  to the formatted artist data.
 */
function createArtistsFromItunesData(tracks) {
  const artistMap = new Map();
  tracks.forEach(track => {
    const artistPath = upLevels(track.Location, 2);
    if (artistMap.has(artistPath)) {
      const artist = artistMap.get(artistPath);
      artist.tracks.push(track['Persistent ID']);
      getGenres(track).forEach(genre => artist.genres.add(genre));
      artist.albums.add(upLevels(track.Location));
    } else {
      const artist = {};
      artist.name = track.Artist;
      artist.genres = new Set(getGenres(track));
      artist.tracks = [track['Persistent ID']];
      artist.albums = new Set([upLevels(track.Location)]);
      artistMap.set(artistPath, artist);
    }
  });
  return artistMap;
}

/**
 * Gets the genres for itunes track. Genres are expected to be in the
 * "Comments" attribution, formatted as a comma separated, quoted list.
 * i.e. "Rock", "Indie Rock", "Folk Rock"
 * @param {!Array<!Object>} tracks The itunes tracks to get the genres for.
 * @return {!Array<string>} A list of all genres in the tracks.
 */
function createGenresFromItunesData(tracks) {
  const genreSet = new Set();
  tracks.forEach(track => {
    const genres = getGenres(track);
    genres.forEach((genre) => genreSet.add(genre));
  });
  return [...genreSet];
}

/**
 * Gets the album art from an mp3 file. Saves the the art into its own file and
 * returns a promise with the file path.
 * @param {!Track} track The track to ge the art for
 * @return {!Promise<string>} Promise containing the filepath of the art file.
 */
function getAlbumArt(track) {
  return new Promise((resolve) => {
    const filePath = decodeURI(track.filePath.slice(7)).replace('%23', '#');
    try {
      const readStream = fs.createReadStream(filePath);
      mm(readStream, (err, data) => {
        const id = shortid.generate();
        if (err) {
          return;
        }
        if (data.picture[0] && data.picture[0].data) {
          fs.writeFileSync(`./data/${id}.png`, data.picture[0].data);
        } else {
          resolve(null);
        }
        readStream.close();
        resolve(`./data/${id}.png`);
      });
    } catch (err) {
      resolve(null);
    }
  });
}

/**
 * Creates album data objects from itunes data. Returns a map where each file
 * path string points to the album data.
 * @param {!Array<!Object>} tracks Array of objects containing itunes data
 * @return {!Map<string,!Object>} A map from the location of the albums files
 * to the formatted album data.
 */
function createAlbumsFromItunesData(tracks) {
  const albumMap = new Map();
  tracks.forEach((track) => {
    const albumString = upLevels(track.Location);
    if (albumMap.has(albumString)) {
      const album = albumMap.get(albumString);
      album.tracks.push(track['Persistent ID']);
      getGenres(track).forEach(genre => album.genres.add(genre));
    } else {
      const album = {};
      album.tracks = [track['Persistent ID']];
      album.name = track.Album;
      album.artistPath = upLevels(track.Location, 2);
      album.genres = new Set(getGenres(track));
      album.year = track.Year;
      // TODO: take max/min from tracks?
      album.playCount = 0;
      album.skipCount = 0;
      // TODO: create album art here
      albumMap.set(albumString, album);
    }
  });
  return albumMap;
}

/**
 * Creates tracks from an itunes data map.
 * @param {!Array<!Object>} tracks An array of objects containing the track
 *  data from an itunes manifest.
 * @return {!Array<!Object>} An of objects with track data formatted properly.
 */
function createTracksFromItunesData(tracks) {
  const trackMap = new Map();
  tracks.forEach(trackData => {
    const persistentId = trackData['Persistent ID'];
    // make these into formal data classes?
    const track = {};
    track.name = trackData.Name;
    track.duration = trackData['Total Time'];
    track.filePath = trackData.Location;
    track.year = trackData.Year;
    track.playCount = trackData['Play Count'];
    track.skipCount = trackData['Skip Count'];
    track.mainArtist = trackData.Artist;
    track.mainAlbum = trackData.Album;
    track.genres = new Set(getGenres(trackData));
    track.trackNumber = trackData['Track Number'];
    //const track = new Track({
    //  name: trackData['Name'],
    //  duration: trackData['Total Time'],
    //  filePath: trackData['Location'],
    //  year: trackData['Year'],
    //  playCount: trackData['Play Count'],
    //  skipCount: trackData['Skip Count'],
    //});
    trackMap.set(persistentId, track);
  });
  return trackMap;
}

/**
 * Loads a library from a given file.
 * @param {string} libraryFile The file containing the library in JSON.
 * @return {!Promise<!Library>} a promise returning the library.
 */
export function loadLibrary(libraryFile) {
  return new Promise((resolve, reject) => {
    fs.readFile(libraryFile, (err, data) => {
      if (err) {
        return reject(err);
      }
      const libraryData = JSON.parse(data);
      const tracks = libraryData.tracks_.map(
        (trackData, index) => new Track(index, trackData));
      const albums = libraryData.albums_.map(
        (albumData) => new Album(albumData));
      const artists = libraryData.artists_.map(
        (artistData) => new Artist(artistData));
      const genres = libraryData.genres_;
      const playlists = libraryData.playlists_.map(
        (playlistData) => new Playlist(playlistData)
      );
      return resolve(new Library(tracks, albums, artists, genres, playlists));
    });
  });
}

/**
 * Deletes a directory and all its contents.
 * @param {string} filepath The path to the directory to delete.
 */
function deleteRecursive(filepath) {
  if (!fs.existsSync(path)) {
    return;
  }
  fs.readDirSync(path).forEach((file) => {
    const curPath = path.join(filepath, file);
    if (fs.lstatSync(curPath).isDirectory()) {
      deleteRecursive(curPath);
    } else {
      fs.unlinkSync(curPath);
    }
  });
  fs.rmdirSync(path);
}

/**
 * Deletes the data directory.
 * @return {!Promise} a promise resolving once completed.
 */
export function deleteLibrary() {
  return new Promise((resolve) => {
    deleteRecursive('./data/');
    resolve();
  });
}

/**
 * Reads a library from an itunes manifest file and turns it into a library.
 * @return {!Promise<!Library>} a promise returning the created library.
 */
export function createLibraryFromItunes() {
  // reload itunes data -> json
  // TODO: delete tracks.json?
  // TODO: prompt user for itunes file if not one saved
  // create data dir if not exist ?
  // switch to only use playlists
  // (master playlist contains all songs, no need to run this twice)

  return new Promise((resolve) => {
    if (!fs.existsSync('./data')) {
      fs.mkdirSync('./data');
    }
    execSync('./node_modules/itunes-data/cli.js --tracks data/tracks.json ' +
      '~/Music/iTunes/iTunes\\ Music\\ Library.xml', {
      stdio: 'inherit'
    });
    execSync('./node_modules/itunes-data/cli.js --playlists ' +
      'data/playlists.json ~/Music/iTunes/iTunes\\ Music\\ Library.xml', {
      stdio: 'inherit'
    });
    const trackFile = './data/tracks.json';
    const playlistFile = './data/playlists.json';
    const trackFileData = fs.readFileSync(trackFile);
    const playlistFileData = fs.readFileSync(playlistFile);
    const rawTrackData = JSON.parse(trackFileData);
    const rawPlaylistFileData = JSON.parse(playlistFileData);
    const realPlaylists = rawPlaylistFileData.filter((playlist) => {
      return !(playlist.Name === "Library" || playlist['Smart Criteria']);
    });
    const trackData = new Map();
    rawTrackData.forEach((track) => {
      trackData.set(track['Persistent ID'], track);
    });
    const genreArray = createGenresFromItunesData(trackData);

    /** {map<path,data>} */
    const artistMap = createArtistsFromItunesData(trackData);

    /** {map<path,data>} */
    const albumMap = createAlbumsFromItunesData(trackData);

    /** {map<pid,data>} */
    const trackMap = createTracksFromItunesData(trackData);


    // sort tracks in albums:
    albumMap.forEach((albumData) => {
      albumData.tracks.sort((trackId1, trackId2) => {
        const track1 = trackMap.get(trackId1);
        const track2 = trackMap.get(trackId2);
        return track1.trackNumber - track2.trackNumber;
      });
    });
    const genreMap = new Map();
    genreArray.forEach((genre, index) => {
      genreMap.set(genre, index);
    });
    const artists = [];
    artistMap.forEach((artistData) => {
      artists.push(new Artist({
        name: artistData.name,
      }));
      artistData.id = artists.length - 1;
    });
    const albums = [];
    albumMap.forEach((albumData) => {
      albums.push(new Album({
        name: albumData.name,
        year: albumData.year,
        albumArtFile: albumData.albumArtFile,
      }));
      albumData.id = albums.length - 1;
    });
    const tracks = [];
    trackMap.forEach((data, index) => {
      tracks.push(new Track(index, {
        name: data.name,
        duration: data.duration,
        filePath: data.filePath,
        year: data.year,
        playCount: data.playCount,
        skipCount: data.skipCount,
      }));
      data.id = tracks.length - 1;
    });
    // set genre ids
    albumMap.forEach((albumData) => {
      const album = albums[albumData.id];
      albumData.genres.forEach((genreName) => {
        const genreId = genreMap.get(genreName);
        album.genreIds.push(genreId);
      });
    });
    artistMap.forEach((artistData) => {
      const artist = artists[artistData.id];
      artistData.genres.forEach((genreName) => {
        const genreId = genreMap.get(genreName);
        artist.genreIds.push(genreId);
      });
    });
    trackMap.forEach((data) => {
      const track = tracks[data.id];
      data.genres.forEach((genreName) => {
        const genreId = genreMap.get(genreName);
        track.genreIds.push(genreId);
      });
    });

    // set artist ids
    albumMap.forEach((albumData) => {
      const album = albums[albumData.id];
      const artistData = artistMap.get(albumData.artistPath);
      album.artistIds.push(artistData.id);
    });
    trackMap.forEach((data) => {
      const track = tracks[data.id];
      const artistLocation = upLevels(data.filePath, 2);
      const artistData = artistMap.get(artistLocation);
      track.artistIds.push(artistData.id);
    });

    // set album ids
    trackMap.forEach((data) => {
      const track = tracks[data.id];
      const albumLocation = upLevels(data.filePath);
      const albumData = albumMap.get(albumLocation);
      track.albumIds.push(albumData.id);
    });
    albumMap.forEach((albumData) => {
      const artistData = artistMap.get(albumData.artistPath);
      const artist = artists[artistData.id];
      artist.albumIds.push(albumData.id);
    });
    // set track ids
    trackMap.forEach((data) => {
      const artistLocation = upLevels(data.filePath, 2);
      const artistData = artistMap.get(artistLocation);
      const artist = artists[artistData.id];
      artist.trackIds.push(data.id);
    });
    albumMap.forEach((albumData) => {
      const album = albums[albumData.id];
      album.trackIds = albumData.tracks.map((trackPid) => {
        const data = trackMap.get(trackPid);
        return data.id;
      });
    });
    const playlists = realPlaylists.map((playlist) => {
      const trackIds = playlist.Tracks.filter((track) => track != null)
        .map((track) => {
          return trackMap.get(track['Persistent ID']).id;
        });
      return new Playlist({name: playlist.Name, trackIds});
    });

    const promises = [];
    albumMap.forEach((albumData) => {
      const track = trackMap.get(albumData.tracks[0]);
      const album = albums[albumData.id];
      // TODO: check multiple tracks for album art data?
      promises.push(getAlbumArt(track).then((artFile) => {
        album.albumArtFile = artFile;
      }));
    });
    Promise.all(promises).then(() => {
      resolve(new Library(tracks, albums, artists, genreArray, playlists));
    });
  });
}

