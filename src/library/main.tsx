import {Album, Artist, Genre, LibraryState, Track} from '../redux/actionTypes';
import {DATA_DIR} from '../constants';
import fs from 'fs';
import path from 'path';

/**
 * Loads a library from a given file.
 */
export function loadLibrary(libraryFile: string): Promise<LibraryState> {
  // TODO: why do this? Is it just to parse the dates? Gotta be an easier way...
  return new Promise((resolve, reject) => {
    fs.readFile(libraryFile, (err: Error | null, data: Buffer) => {
      if (err) {
        return reject(err);
      }
      try {
        const libraryData = JSON.parse(data.toString()) as LibraryState;
        return resolve({
          albums: Object.values(libraryData.albums).reduce((map: Record<string, Album>, albumData: Album) => {
            map[albumData.id] = {
            id: albumData.id,
            errors: albumData.errors,
            albumArtFile: albumData.albumArtFile,
            artistIds: albumData.artistIds,
            name: albumData.name,
            trackIds: albumData.trackIds,
            year: albumData.year,
            wikiPage: albumData.wikiPage,
            genreIds: albumData.genreIds,
            playCount: albumData.playCount,
            skipCount: albumData.skipCount,
            favorites: albumData.favorites,
            };
            return map;
          }, {} as Record<string, Album>),

          artists: Object.values(libraryData.artists).reduce((map: Record<string, Artist>, artistData: Artist) => {
          map[artistData.id] = {
            id: artistData.id,
            name: artistData.name,
            albumIds: artistData.albumIds,
            artFile: artistData.artFile,
            errors: artistData.errors,
            wikiPage: artistData.wikiPage,
            genreIds: artistData.genreIds,
            trackIds: artistData.trackIds,
            memberIds: artistData.memberIds || [],
          };
          return map;
          }, {} as Record<string, Artist>),
          tracks: Object.values(libraryData.tracks).reduce((map: Record<string, Track>, trackData: Track) => {
        map[trackData.id] = {
            id: trackData.id,
            duration: trackData.duration,
            playCount: trackData.playCount,
            playDate: new Date(trackData.playDate),
            filePath: trackData.filePath,
            artistIds: trackData.artistIds,
            albumIds: trackData.albumIds,
            name: trackData.name,
            year: trackData.year,
            genreIds: trackData.genreIds,
            skipCount: trackData.skipCount,
            dateAdded: new Date(trackData.dateAdded),
            favorites: trackData.favorites,
            genius: trackData.genius,
            warning: trackData.warning,
        };
        return map;
      }, {} as Record<string, Track>),
          genres: Object.keys(libraryData.genres).reduce((map: Record<string, Genre>, genreId: string) => {
            map[genreId] = {
              name: libraryData.genres[genreId].name,
            };
            return map;
          }, {} as Record<string, Genre>),
          playlists: libraryData.playlists,
          newTracks: libraryData.newTracks,
        });
      } catch (err) {
        reject(err);
      }
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
