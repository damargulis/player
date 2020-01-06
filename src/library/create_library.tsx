import Album, {AlbumParameters} from "./Album";
import Artist, {ArtistParameters} from "./Artist";
import {DATA_DIR} from "../constants";
import fs from "fs";
import Library from "./Library";
import mm from "musicmetadata";
import path from "path";
import Playlist, {PlaylistParameters} from "./Playlist";
import shortid from "shortid";
import Track, {TrackParameters} from "./Track";

import plist from "plist";

interface TempArtistData {
  albums: Set<string>;
  genres: Set<string>;
  id: number;
  name: string;
  tracks: number[];
}

interface TempTrackData {
  id: number;
  dateAdded: string;
  duration: number;
  filePath: string;
  genres: Set<string>;
  mainAlbum: string;
  mainArtist: string;
  name: string;
  playCount: number;
  playDate: string;
  skipCount: number;
  trackNumber: number;
  year: number;
}

interface TempAlbumData {
  id: number;
  albumArtFile: string;
  artistPath: string;
  genres: Set<string>;
  name: string;
  playCount: number;
  skipCount: number;
  tracks: number[];
  year: number;
}

interface ItunesTrackData {
  "Track ID": number;
  "Date Added": string;
  "Total Time": string;
  Location: string;
  Comments: string;
  Album: string;
  Artist: string;
  Name: string;
  "Play Count": number;
  "Play Date UTC": string;
  "Skip Count": number;
  "Track Number": number;
  Year: number;
}

interface ItunesPlaylistData {
  "Playlist Items": Array<{
    "Track ID": number;
  }>;
  Name: string;
  "Smart Criteria": string;
  "Distinguished Kind": number;
}

interface ItunesData {
  Tracks: Record<string, ItunesTrackData>;
  Playlists: ItunesPlaylistData[];
}

// TODO: redo this whole thing and just save the damn ids...

/**
 * Gets the genres for a single itunes track. Genres are expected to be in the
 * "Comments" attribution, formatted as a comma separated, quoted list.
 * i.e. "Rock", "Indie Rock", "Folk Rock"
 */
function getGenres(trackData: {Comments: string}): string[] {
  return trackData.Comments.split(", ").map((genre) => genre.slice(1, -1));
}

/**
 * Returns the file path levels up from the path given.
 */
function upLevels(filePath: string, levels = 1): string {
  const parts = filePath.split(path.sep);
  const newparts = parts.slice(0, -1 * levels);
  return path.join(...newparts);
}

/**
 * Creates the artists data from itunes data.
 * TODO: create an itunes type file that exports the itunes data maps
 * remove the anys
 */
function createArtistsFromItunesData(tracks: Map<number, ItunesTrackData>): Map<string, TempArtistData> {
  const artistMap = new Map();
  tracks.forEach((track: ItunesTrackData) => {
    const artistPath = upLevels(track.Location, 2);
    if (artistMap.has(artistPath)) {
      const artist = artistMap.get(artistPath);
      artist.tracks.push(track["Track ID"]);
      getGenres(track).forEach((genre) => artist.genres.add(genre));
      artist.albums.add(upLevels(track.Location));
    } else {
      const artist = {
        albums: new Set([upLevels(track.Location)]),
        genres: new Set(getGenres(track)),
        name: track.Artist,
        tracks: [track["Track ID"]],
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
function createGenresFromItunesData(tracks: Map<string, ItunesTrackData>): string[] {
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
function getAlbumArt(track: TempTrackData): Promise<string|undefined> {
  return new Promise((resolve) => {
    const filePath = decodeURI(track.filePath.slice(7)).replace("%23", "#");
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

/**
 * Creates album data objects from itunes data. Returns a map where each file
 * path string points to the album data.
 */
function createAlbumsFromItunesData(tracks: Map<string, ItunesTrackData>): Map<string, TempAlbumData> {
  const albumMap = new Map();
  tracks.forEach((track) => {
    const albumString = upLevels(track.Location);
    if (albumMap.has(albumString)) {
      const album = albumMap.get(albumString);
      album.tracks.push(track["Track ID"]);
      getGenres(track).forEach((genre) => album.genres.add(genre));
    } else {
      const album = {
        artistPath: upLevels(track.Location, 2),
        genres: new Set(getGenres(track)),
        name: track.Album,
        playCount: 0,
        skipCount: 0,
        tracks: [track["Track ID"]],
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
function createTracksFromItunesData(tracks: Map<string, ItunesTrackData>): Map<number, TempTrackData> {
  const trackMap = new Map();
  tracks.forEach((trackData) => {
    const persistentId = trackData["Track ID"];
    // make these into formal data classes?
    const track = {
      dateAdded: trackData["Date Added"],
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
    fs.readFile(libraryFile, (err: Error | null, data: Buffer) => {
      if (err) {
        return reject(err);
      }
      const libraryData = JSON.parse(data.toString());
      const tracks = libraryData.tracks.map(
        (trackData: TrackParameters, index: number) => new Track(index, trackData));
      const albums = libraryData.albums.map(
        (albumData: AlbumParameters, index: number) => new Album(index, albumData));
      const artists = libraryData.artists.map(
        (artistData: ArtistParameters, index: number) => new Artist(index, artistData));
      const genres = libraryData.genres;
      const playlists = libraryData.playlists.map(
        (playlistData: PlaylistParameters) => new Playlist(playlistData),
      );
      return resolve(new Library(tracks, albums, artists, genres, playlists));
    });
  });
}

/**
 * Deletes a directory and all its contents.
 */
function deleteRecursive(filepath: string): void {
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

/** Deletes the data directory. */
export function deleteLibrary(): Promise<void> {
  return new Promise((resolve) => {
    deleteRecursive(DATA_DIR);
    resolve();
  });
}

/** Reads a library from an itunes manifest file and turns it into a library. */
export function createLibraryFromItunes(): Promise<Library> {
  // TODO: prompt user for itunes file if not one saved
  // create data dir if not exist ?

  return new Promise((resolve) => {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR);
    }

    // TODO: ask the user for this
    const ITUNES_FILE = "/Users/damargulis/Music/iTunes/iTunes Music Library.xml";
    const itunesData = fs.readFileSync(ITUNES_FILE);
    let xmlData = itunesData.toString();
    xmlData = xmlData.replace(/[\n\t\r]/g, "");
    const plistParsed = plist.parse(xmlData) as unknown as ItunesData;
    const trackData = new Map();
    Object.keys(plistParsed.Tracks).forEach((trackId) => {
      const track = plistParsed.Tracks[trackId];
      trackData.set(track["Track ID"], track);
    });
    const realPlaylists = plistParsed.Playlists.filter((playlist: ItunesPlaylistData) => {
      return !(playlist.Name === "Library" || playlist["Smart Criteria"] || playlist["Distinguished Kind"])
        && playlist["Playlist Items"];
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
      albumData.tracks.sort((trackId1: number, trackId2: number) => {
        const track1 = trackMap.get(trackId1);
        const track2 = trackMap.get(trackId2);
        if (!track1 || !track2) {
          return 0;
        }
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
      if (artistData) {
        album.artistIds.push(artistData.id);
      }
    });
    trackMap.forEach((data) => {
      const track = tracks[data.id];
      const artistLocation = upLevels(data.filePath, 2);
      const artistData = artistMap.get(artistLocation);
      if (artistData) {
        track.artistIds.push(artistData.id);
      }
    });

    // set album ids
    trackMap.forEach((data) => {
      const track = tracks[data.id];
      const albumLocation = upLevels(data.filePath);
      const albumData = albumMap.get(albumLocation);
      if (albumData) {
        track.albumIds.push(albumData.id);
      }
    });
    albumMap.forEach((albumData) => {
      const artistData = artistMap.get(albumData.artistPath);
      if (artistData) {
        const artist = artists[artistData.id];
        artist.albumIds.push(albumData.id);
      }
    });
    // set track ids
    trackMap.forEach((data) => {
      const artistLocation = upLevels(data.filePath, 2);
      const artistData = artistMap.get(artistLocation);
      if (artistData) {
        const artist = artists[artistData.id];
        artist.trackIds.push(data.id);
      }
    });
    albumMap.forEach((albumData) => {
      const album = albums[albumData.id];
      album.trackIds = albumData.tracks.map((trackPid: number) => {
        const data = trackMap.get(trackPid);
        return (data && data.id) || 0;
      });
    });
    const playlists = realPlaylists.map((playlist: ItunesPlaylistData) => {
      const trackIds = playlist["Playlist Items"].filter((track: {"Track ID": number}) => !!track)
        .map((track: {"Track ID": number}) => {
          const data = trackMap.get(track["Track ID"]);
          return (data && data.id) || 0;
        });
      return new Playlist({name: playlist.Name, trackIds});
    });

    const promises = [] as Array<Promise<void>>;
    albumMap.forEach((albumData) => {
      const track = trackMap.get(albumData.tracks[0]);
      const album = albums[albumData.id];
      // TODO: check multiple tracks for album art data?
      if (track) {
        promises.push(getAlbumArt(track).then((artFile: string|undefined) => {
          if (artFile) {
            album.albumArtFile = artFile;
          }
        }));
      }
    });
    Promise.all(promises).then(() => {
      resolve(new Library(tracks, albums, artists, genreArray, playlists));
    });
  });
}
