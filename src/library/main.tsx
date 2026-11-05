import {Album, Artist, Genre, LibraryState, Track} from '../redux/actionTypes';
import {DATA_DIR} from '../constants';
import {ExtensionError, migrateLegacyErrors, withError} from '../extensions/errors';
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
            // ALBUM_ART says "this album has no art", so it is derived from whether it has a
            // file rather than trusted from storage — 257 albums here were flagged despite
            // having art, and 34 without any were not flagged at all.
            errors: withError(migrateLegacyErrors(albumData.errors),
              ExtensionError.ALBUM_ART, !albumData.albumArtFile),
            albumArtFile: albumData.albumArtFile,
            coverArt: albumData.coverArt,
            artistIds: albumData.artistIds,
            name: albumData.name,
            trackIds: albumData.trackIds,
            year: albumData.year,
            wikiPage: albumData.wikiPage,
            mbid: albumData.mbid,
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
            // PIC is the same shape of claim as ALBUM_ART, and was wrong the same way
            errors: withError(migrateLegacyErrors(artistData.errors),
              ExtensionError.PIC, !artistData.artFile),
            wikiPage: artistData.wikiPage,
            mbid: artistData.mbid,
            genreIds: artistData.genreIds,
            trackIds: artistData.trackIds,
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
            reactions: trackData.reactions,
            genius: trackData.genius,
            // Dropping a field here does not fail anywhere: the track loads, the app runs, and
            // the next save writes the library back without it. `lyrics` was missing, so every
            // restart silently erased 18,949 lyrics markers while leaving the .lrc files on
            // disk. `libraryRoundTrip.test.js` now fails if any field is left out again.
            lyrics: trackData.lyrics,
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
