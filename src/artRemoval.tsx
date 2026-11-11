import {Album, AlbumInfo, Artist, ArtistInfo} from './redux/actionTypes';
import {ExtensionError, withError} from './extensions/errors';
import fs from 'fs';
import {RootState} from './redux/store';

/**
 * Taking a wrong picture off an album or an artist.
 *
 * Needed because the extensions only ever *add*: `artFile.tsx` writes an image when it is
 * bigger than what is there and nothing has ever removed one, so a picture downloaded against
 * a bad MusicBrainz match was permanent. Clearing the mbid does not help — the file is already
 * on disk and the entity still points at it — and no extension will replace a picture with
 * nothing, because "no picture" is not something any of them can find.
 */

/**
 * Whether any entity other than this one still points at the file.
 *
 * Nothing in this library shares an art path today (3,044 distinct paths across 2,181 albums
 * and 1,102 artists, none repeated), but checking is a line of code and it makes deleting the
 * file safe by construction rather than by coincidence.
 */
export function isShared(store: RootState, filePath: string, ownerId: string): boolean {
  const albums = Object.values(store.library.albums)
    .some((album) => album.id !== ownerId && album.albumArtFile === filePath);
  const artists = Object.values(store.library.artists)
    .some((artist) => artist.id !== ownerId && artist.artFile === filePath);
  return albums || artists;
}

/**
 * Deletes the file, if it is only this entity's.
 *
 * A failure is deliberately ignored. The point of the action is that the entity stops showing
 * the picture, and that has already been decided by the caller; a file that will not unlink
 * becomes one more of the 2,515 orphans already in `data/` rather than a failed operation.
 */
function deleteFile(store: RootState, filePath: string, ownerId: string): void {
  if (isShared(store, filePath, ownerId)) {
    return;
  }
  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    // already gone, or not ours to delete
  }
}

/**
 * The album update that removes its cover, and the file with it.
 *
 * `coverArt` goes too: it records what the Cover Art Archive served for art that no longer
 * exists, and left behind it would describe a file that is not there. `ALBUM_ART` is set
 * through the same `withError` the extensions and `loadLibrary` use — the album now genuinely
 * has no cover, which is exactly what that error states.
 */
export function removeAlbumArt(store: RootState, album: Album): AlbumInfo {
  if (album.albumArtFile) {
    deleteFile(store, album.albumArtFile, album.id);
  }
  return {
    albumArtFile: undefined,
    coverArt: undefined,
    errors: withError(album.errors, ExtensionError.ALBUM_ART, /* missing= */ true),
  };
}

/** The same for an artist's picture. */
export function removeArtistArt(store: RootState, artist: Artist): ArtistInfo {
  if (artist.artFile) {
    deleteFile(store, artist.artFile, artist.id);
  }
  return {
    artFile: undefined,
    errors: withError(artist.errors, ExtensionError.PIC, /* missing= */ true),
  };
}
