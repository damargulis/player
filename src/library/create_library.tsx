import Album from "./Album";
import Artist from "./Artist";
import {execSync} from "child_process";
import fs from "fs";
import Library from "./Library";
import mm from "musicmetadata";
import path from "path";
import Playlist from "./Playlist";
import shortid from "shortid";
import Track from "./Track";

// TODO: redo this whole thing and just save the damn ids...

/**
 * Gets the genres for a single itunes track. Genres are expected to be in the
 * "Comments" attribution, formatted as a comma separated, quoted list.
 * i.e. "Rock", "Indie Rock", "Folk Rock"
 */
function getGenres(trackData: {Comments: string}) {
  return trackData.Comments.split(", ").map((genre) => genre.slice(1, -1));
}

/**
 * Returns the file path levels up from the path given.
 */
function upLevels(filePath: string, levels = 1) {
  const parts = filePath.split(path.sep);
  const newparts = parts.slice(0, -1 * levels);
  return path.join(...newparts);
}

/**
 * Creates the artists data from itunes data.
 * TODO: create an itunes type file that exports the itunes data maps
 * remove the anys
 */
function createArtistsFromItunesData(tracks: any) {
  const artistMap = new Map();
  tracks.forEach((track: any) => {
    const artistPath = upLevels(track.Location, 2);
    if (artistMap.has(artistPath)) {
      const artist = artistMap.get(artistPath);
      artist.tracks.push(track["Persistent ID"]);
      getGenres(track).forEach((genre) => artist.genres.add(genre));
      artist.albums.add(upLevels(track.Location));
    } else {
      const artist = {
        albums: new Set([upLevels(track.Location)]),
        genres: new Set(getGenres(track)),
        name: track.Artist,
        tracks: [track["Persistent ID"]],
      };
      artistMap.set(artistPath, artist);
    }
  });
  return artistMap;
}

/**
 * Gets the genres for itunes track. Genres are expected to be in the
 * "Comments" attribution, formatted as a comma separated, quoted list.
 * i.e. "Rock", "Indie Rock", "Folk Rock"
 */
function createGenresFromItunesData(tracks: Map<string, any>): string[] {
  const genreSet = new Set() as Set<string>;
  tracks.forEach((track) => {
    const genres = getGenres(track);
    genres.forEach((genre) => genreSet.add(genre));
  });
  return [...genreSet];
}

/**
 * Gets the album art from an mp3 file. Saves the the art into its own file and
 * returns a promise with the file path.
 */
function getAlbumArt(track: Track): Promise<string|null> {
  return new Promise((resolve) => {
    const filePath = decodeURI(track.filePath.slice(7)).replace("%23", "#");
    try {
      const readStream = fs.createReadStream(filePath);
      mm(readStream, (err: Error | null, data: any) => {
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
 */
function createAlbumsFromItunesData(tracks: Map<string, any>) {
  const albumMap = new Map();
  tracks.forEach((track) => {
    const albumString = upLevels(track.Location);
    if (albumMap.has(albumString)) {
      const album = albumMap.get(albumString);
      album.tracks.push(track["Persistent ID"]);
      getGenres(track).forEach((genre) => album.genres.add(genre));
    } else {
      const album = {
        artistPath: upLevels(track.Location, 2),
        genres: new Set(getGenres(track)),
        name: track.Album,
        playCount: 0,
        skipCount: 0,
        tracks: [track["Persistent ID"]],
        year: track.Year,
      };
      // TODO: create album art here
      albumMap.set(albumString, album);
    }
  });
  return albumMap;
}

/**
 * Creates tracks from an itunes data map.
 */
function createTracksFromItunesData(tracks: Map<string, any>) {
  const trackMap = new Map();
  tracks.forEach((trackData) => {
    const persistentId = trackData["Persistent ID"];
    // make these into formal data classes?
    const track = {
      dataAdded: trackData["Date Added"],
      duration: trackData["Total Time"],
      filePath: trackData.Location,
      genres: new Set(getGenres(trackData)),
      mainAlbum: trackData.Album,
      mainArtist: trackData.Artist,
      name: trackData.Name,
      playCount: trackData["Play Count"],
      playDate: trackData["Play Date UTC"],
      skipCount: trackData["Skip Count"],
      trackNumber: trackData["Track Number"],
      year: trackData.Year,
    };
    trackMap.set(persistentId, track);
  });
  return trackMap;
}

/**
 * Loads a library from a given file.
 */
export function loadLibrary(libraryFile: string): Promise<Library> {
  return new Promise((resolve, reject) => {
    fs.readFile(libraryFile, (err: Error | null, data: any) => {
      if (err) {
        return reject(err);
      }
      const libraryData = JSON.parse(data);
      const tracks = libraryData.tracks_.map(
        (trackData: any, index: number) => new Track(index, trackData));
      const albums = libraryData.albums_.map(
        (albumData: any, index: number) => new Album(index, albumData));
      const artists = libraryData.artists_.map(
        (artistData: any, index: number) => new Artist(index, artistData));
      const genres = libraryData.genres_;
      const playlists = libraryData.playlists_.map(
        (playlistData: any) => new Playlist(playlistData),
      );
      return resolve(new Library(tracks, albums, artists, genres, playlists));
    });
  });
}

/**
 * Deletes a directory and all its contents.
 */
function deleteRecursive(filepath: string) {
  if (!fs.existsSync(filepath)) {
    return;
  }
  fs.readdirSync(filepath).forEach((file: string) => {
    const curPath = path.join(filepath, file);
    if (fs.lstatSync(curPath).isDirectory()) {
      deleteRecursive(curPath);
    } else {
      fs.unlinkSync(curPath);
    }
  });
  fs.rmdirSync(filepath);
}

/**
 * Deletes the data directory.
 * @return {!Promise} a promise resolving once completed.
 */
export function deleteLibrary() {
  return new Promise((resolve) => {
    deleteRecursive("./data/");
    resolve();
  });
}

/**
 * Reads a library from an itunes manifest file and turns it into a library.
 */
export function createLibraryFromItunes(): Promise<Library> {
  // reload itunes data -> json
  // TODO: delete tracks.json?
  // TODO: prompt user for itunes file if not one saved
  // create data dir if not exist ?
  // switch to only use playlists
  // (master playlist contains all songs, no need to run this twice)

  return new Promise((resolve) => {
    if (!fs.existsSync("./data")) {
      fs.mkdirSync("./data");
    }
    execSync("./node_modules/itunes-data/cli.js --tracks data/tracks.json " +
      "~/Music/iTunes/iTunes\\ Music\\ Library.xml", {
      stdio: "inherit",
    });
    execSync("./node_modules/itunes-data/cli.js --playlists " +
      "data/playlists.json ~/Music/iTunes/iTunes\\ Music\\ Library.xml", {
      stdio: "inherit",
    });
    const trackFile = "./data/tracks.json";
    const playlistFile = "./data/playlists.json";
    const trackFileData = fs.readFileSync(trackFile);
    const playlistFileData = fs.readFileSync(playlistFile);
    const rawTrackData = JSON.parse(trackFileData.toString());
    const rawPlaylistFileData = JSON.parse(playlistFileData.toString());
    const realPlaylists = rawPlaylistFileData.filter((playlist: any) => {
      return !(playlist.Name === "Library" || playlist["Smart Criteria"]);
    });
    const trackData = new Map();
    rawTrackData.forEach((track: any) => {
      trackData.set(track["Persistent ID"], track);
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
      albumData.tracks.sort((trackId1: string, trackId2: string) => {
        const track1 = trackMap.get(trackId1);
        const track2 = trackMap.get(trackId2);
        return track1.trackNumber - track2.trackNumber;
      });
    });
    const genreMap = new Map();
    genreArray.forEach((genre, index) => {
      genreMap.set(genre, index);
    });
    const artists = [] as Artist[];
    artistMap.forEach((artistData) => {
      artists.push(new Artist(artists.length, {
        name: artistData.name,
      }));
      artistData.id = artists.length - 1;
    });
    const albums = [] as Album[];
    albumMap.forEach((albumData) => {
      albums.push(new Album(albums.length, {
        albumArtFile: albumData.albumArtFile,
        name: albumData.name,
        year: albumData.year,
      }));
      albumData.id = albums.length - 1;
    });
    const tracks = [] as Track[];
    trackMap.forEach((data) => {
      data.id = tracks.length;
      tracks.push(new Track(tracks.length, {
        dateAdded: data.dateAdded,
        duration: data.duration,
        filePath: data.filePath,
        name: data.name,
        playCount: data.playCount,
        playDate: data.playDate,
        skipCount: data.skipCount,
        year: data.year,
      }));
    });
    // set genre ids
    albumMap.forEach((albumData) => {
      const album = albums[albumData.id];
      albumData.genres.forEach((genreName: string) => {
        const genreId = genreMap.get(genreName);
        album.genreIds.push(genreId);
      });
    });
    artistMap.forEach((artistData) => {
      const artist = artists[artistData.id];
      artistData.genres.forEach((genreName: string) => {
        const genreId = genreMap.get(genreName);
        artist.genreIds.push(genreId);
      });
    });
    trackMap.forEach((data) => {
      const track = tracks[data.id];
      data.genres.forEach((genreName: string) => {
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
      album.trackIds = albumData.tracks.map((trackPid: string) => {
        const data = trackMap.get(trackPid);
        return data.id;
      });
    });
    const playlists = realPlaylists.map((playlist: any) => {
      const trackIds = playlist.Tracks.filter((track: any) => track != null)
        .map((track: any) => {
          return trackMap.get(track["Persistent ID"]).id;
        });
      return new Playlist({name: playlist.Name, trackIds});
    });

    const promises = [] as Array<Promise<void>>;
    albumMap.forEach((albumData) => {
      const track = trackMap.get(albumData.tracks[0]);
      const album = albums[albumData.id];
      // TODO: check multiple tracks for album art data?
      promises.push(getAlbumArt(track).then((artFile: string|null) => {
        if (artFile) {
          album.albumArtFile = artFile;
        }
      }));
    });
    Promise.all(promises).then(() => {
      resolve(new Library(tracks, albums, artists, genreArray, playlists));
    });
  });
}
