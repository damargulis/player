import {Album, Artist, Genre, LibraryState, Track} from '../redux/actionTypes';
import {DATA_DIR} from '../constants';
import {ExtensionError, migrateLegacyErrors, withError, withSourceErrors} from '../extensions/errors';
import fs from 'fs';

/**
 * Genre names that are plainly not genres.
 *
 * Wikipedia injects TemplateStyles into the infobox, and the genre parser used to walk into
 * that `<style>` element and split its CSS on commas — so `.mw-parser-output .hlist dl` and 38
 * more like it became genres. `wiki/utils.tsx` no longer reads them, but 39 were already
 * stored, and they show up in every genre picker.
 */
function looksLikeCss(name: string): boolean {
  // Structural only. All 39 in this library carry braces, semicolons or a leading dot, so a
  // length limit rejected nothing real while risking a long genuine genre.
  return /[{};<>]/.test(name) || name.startsWith('.');
}

/**
 * Drops stored genres that are CSS fragments **and referenced by nothing**.
 *
 * Referenced ones are kept: removing a genre something points at would leave a dangling id,
 * and a visible wrong genre is better than a broken reference. In this library all 39 were
 * orphans, so nothing loses a genre. Done on load so the file repairs itself rather than
 * needing hand surgery, the same way the art errors do.
 */
function dropJunkGenres(libraryData: LibraryState): Record<string, Genre> {
  const referenced = new Set<string>();
  [libraryData.tracks, libraryData.albums, libraryData.artists].forEach((collection) => {
    Object.values(collection || {}).forEach((entity: {genreIds?: string[]}) => {
      (entity.genreIds || []).forEach((id) => referenced.add(id));
    });
  });
  return Object.keys(libraryData.genres).reduce((map: Record<string, Genre>, genreId: string) => {
    const name = libraryData.genres[genreId].name;
    if (looksLikeCss(name) && !referenced.has(genreId)) {
      return map;
    }
    map[genreId] = {name};
    return map;
  }, {} as Record<string, Genre>);
}

/**
 * The id an entity was saved under. The key is what everything else refers to it by; the stored
 * `id` field only repeats it. An entity saved without that field (an artist created from a track
 * hint before the reducer set it) used to be re-keyed to "undefined" here, which disconnected it
 * from every track crediting it and broke each page listing those tracks.
 */
function savedId(key: string, entity: {id?: string}): string {
  return entity.id || key;
}

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
          albums: Object.entries(libraryData.albums).reduce((map: Record<string, Album>, [key, albumData]) => {
            const id = savedId(key, albumData);
            map[id] = {
            id,
            // ALBUM_ART says "this album has no art", so it is derived from whether it has a
            // file rather than trusted from storage — 257 albums here were flagged despite
            // having art, and 34 without any were not flagged at all.
            // GENRE and YEAR cannot be derived the same way (the iTunes import writes both),
            // so they are re-derived from which sources have reported instead.
            errors: withSourceErrors(
              withError(migrateLegacyErrors(albumData.errors),
                ExtensionError.ALBUM_ART, !albumData.albumArtFile),
              albumData.metaSources),
            albumArtFile: albumData.albumArtFile,
            coverArt: albumData.coverArt,
            metaSources: albumData.metaSources,
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

          artists: Object.entries(libraryData.artists).reduce((map: Record<string, Artist>, [key, artistData]) => {
          const id = savedId(key, artistData);
          map[id] = {
            id,
            name: artistData.name,
            albumIds: artistData.albumIds,
            artFile: artistData.artFile,
            // PIC is the same shape of claim as ALBUM_ART, and was wrong the same way
            errors: withSourceErrors(
              withError(migrateLegacyErrors(artistData.errors),
                ExtensionError.PIC, !artistData.artFile),
              artistData.metaSources),
            metaSources: artistData.metaSources,
            wikiPage: artistData.wikiPage,
            mbid: artistData.mbid,
            genreIds: artistData.genreIds,
            trackIds: artistData.trackIds,
          };
          return map;
          }, {} as Record<string, Artist>),
          tracks: Object.entries(libraryData.tracks).reduce((map: Record<string, Track>, [key, trackData]) => {
        const id = savedId(key, trackData);
        map[id] = {
            id,
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
            mbid: trackData.mbid,
            warning: trackData.warning,
        };
        return map;
      }, {} as Record<string, Track>),
          genres: dropJunkGenres(libraryData),
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
 * Copies library.json into backups/ under the same `<ms>.json` name the daily backups use, so
 * any restore that reads those finds it and pruning treats it like the rest. Returns the copy's
 * path, or undefined when there is no library to copy.
 */
export function snapshotLibraryFile(): string | undefined {
  const source = `${DATA_DIR}/library.json`;
  if (!fs.existsSync(source)) {
    return undefined;
  }
  const backups = `${DATA_DIR}/backups`;
  if (!fs.existsSync(backups)) {
    fs.mkdirSync(backups);
  }
  const target = `${backups}/${Date.now()}.json`;
  fs.copyFileSync(source, target);
  return target;
}
