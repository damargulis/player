import Album from './Album';
import Artist from './Artist';
import Track from './Track';
import Library from './Library';
const fs = require('fs')
const path = require('path');
// open to reload from itunes
//const {execSync} = require('child_process');

const mm = require('musicmetadata');

function upLevels(filePath, levels=1) {
  const parts = filePath.split(path.sep);
  const newparts = parts.slice(0, -1 * levels);
  return path.join(...newparts);
}

function createArtistsFromItunesData(tracks) {
  const artistMap = new Map();
  tracks.forEach(track => {
    const artistPath = upLevels(track['Location'], 2);
    if (artistMap.has(artistPath)) {
      const artist = artistMap.get(artistPath);
      artist.tracks.push(track['Persistent ID']);
      getGenres(track).forEach(genre => artist.genres.add(genre));
      artist.albums.add(upLevels(track['Location']));
    } else {
      const artist = {};
      artist.name = track['Artist'];
      artist.genres = new Set(getGenres(track));
      artist.tracks = [track['Persistent ID']];
      artist.albums = new Set([upLevels(track['Location'])]);
      artistMap.set(artistPath, artist);
    }
  });
  return artistMap;
}

function getGenres(trackData) {
  return trackData['Comments'].split(', ').map(genre => genre.slice(1, -1));
}

function createGenresFromItunesData(tracks) {
  const genreSet = new Set();
  tracks.forEach(track => {
    const genres = getGenres(track);
    genres.forEach((genre) => genreSet.add(genre));
  });
  return [...genreSet];
}

function getAlbumArt(track, artId) {
  return new Promise((resolve, reject) => {
    const filePath = decodeURI(track.filePath.slice(7)).replace('%23', '#');
    try {
      const readStream = fs.createReadStream(filePath);
      mm(readStream, (err, data) => {
        if (err) {
          return;
        }
        if (data.picture[0] && data.picture[0].data) {
          fs.writeFileSync(`./data/${artId}.png`, data.picture[0].data);
        } else {
          resolve(null);
        }
        readStream.close();
        resolve(`./data/${artId}.png`);
      });
    } catch (err) {
      resolve(null);
    }
  });
}

function createAlbumsFromItunesData(tracks) {
  const albumMap = new Map();
  tracks.forEach((track) => {
    const albumString = upLevels(track['Location']);
    if (albumMap.has(albumString)) {
      const album = albumMap.get(albumString);
      album.tracks.push(track['Persistent ID']);
      getGenres(track).forEach(genre => album.genres.add(genre));
    } else {
      const album = {};
      album.tracks = [track['Persistent ID']];
      album.name = track['Album'];
      album.artistPath = upLevels(track['Location'], 2);
      album.genres = new Set(getGenres(track));
      album.year = track['Year'];
      // TODO: take max/min from tracks?
      album.playCount = 0;
      album.skipCount = 0;
      // TODO: create album art here
      albumMap.set(albumString, album);
    }
  });
  return albumMap;
};

function createTracksFromItunesData(tracks) {
  const trackMap = new Map();
  tracks.forEach(trackData => {
    const persistentId = trackData['Persistent ID'];
    // make these into formal data classes?
    const track = {};
    track.name = trackData['Name'];
    track.duration = trackData['Total Time'];
    track.filePath = trackData['Location'];
    track.year = trackData['Year'];
    track.playCount = trackData['Play Count'];
    track.skipCount = trackData['Skip Count'];
    track.mainArtist = trackData['Artist'];
    track.mainAlbum = trackData['Album'];
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

export function createLibrary() {
  // reload itunes data -> json
  //execSync('./node_modules/itunes-data/cli.js --tracks data/tracks.json ~/Music/iTunes/iTunes\\ Music\\ Library.xml', {
  //  stdio: 'inherit'
  //});
  return new Promise((resolve, reject) => {
    //const libraryFile = "file:///Users/damargulis/Music/iTunes/iTunes Music Library.xml";
    //const parser = new itunes.parser();
    //const stream = fs.createReadStream(new URL(libraryFile));
    //const trackData = new Map();

    //parser.on("track", (track) => {
    //  trackData.set(track["Persistent ID"], track);
    //});
    //parser.on('end', () => {
      /** {!Array<string>} */
      const trackFile = './data/tracks.json';
      const trackFileData = fs.readFileSync(trackFile);
      const rawTrackData = JSON.parse(trackFileData);
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
      /** <string, id */
      const genreMap = new Map();
      genreArray.forEach((genre, index) => {
        genreMap.set(genre, index);
      });
      const artists = []
      artistMap.forEach((artistData) => {
        artists.push(new Artist({
          name: artistData.name,
        }));
        artistData.id = artists.length - 1;
      });
      const albums = []
      albumMap.forEach((albumData) => {
        albums.push(new Album({
          name: albumData.name,
          year: albumData.year,
          albumArtFile: albumData.albumArtFile,
        }));
        albumData.id = albums.length - 1;
      });
      const tracks = [];
      trackMap.forEach((trackData) => {
        tracks.push(new Track({
          name: trackData.name,
          duration: trackData.duration,
          filePath: trackData.filePath,
          year: trackData.year,
          playCount: trackData.playCount,
          skipCount: trackData.skipCount,
        }));
        trackData.id = tracks.length - 1;
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
      trackMap.forEach((trackData) => {
        const track = tracks[trackData.id];
        trackData.genres.forEach((genreName) => {
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
      trackMap.forEach((trackData) => {
        const track = tracks[trackData.id];
        const artistLocation = upLevels(trackData.filePath, 2);
        const artistData = artistMap.get(artistLocation);
        track.artistIds.push(artistData.id);
      });

      // set album ids
      trackMap.forEach((trackData) => {
        const track = tracks[trackData.id];
        const albumLocation = upLevels(trackData.filePath);
        const albumData = albumMap.get(albumLocation);
        track.albumIds.push(albumData.id);
      });
      albumMap.forEach((albumData) => {
        const artistData = artistMap.get(albumData.artistPath);
        const artist = artists[artistData.id];
        artist.albumIds.push(albumData.id);
      });
      // set track ids
      trackMap.forEach((trackData) => {
        const artistLocation = upLevels(trackData.filePath, 2);
        const artistData = artistMap.get(artistLocation);
        const artist = artists[artistData.id];
        artist.trackIds.push(trackData.id);
      });
      albumMap.forEach((albumData) => {
        const album = albums[albumData.id];
        album.trackIds = albumData.tracks.map((trackPid) => {
          const trackData = trackMap.get(trackPid);
          return trackData.id;
        });
      });

      const promises = [];
      let id = -1;
      albumMap.forEach((albumData) => {
        id++;
        const track = trackMap.get(albumData.tracks[0]);
        const album = albums[albumData.id];
        // TODO: check multiple tracks for album art data?
        promises.push(getAlbumArt(track, id).then((artFile) => {
          album.albumArtFile = artFile;
        }));
      });
      Promise.all(promises).then(() => {
        resolve(new Library(tracks, albums, artists, genreArray));
      });
    });
    //stream.pipe(parser);
  //});
}

