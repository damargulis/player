import modifyAlbum from './albums';
import modifyArtist from './artists';
const PromisePool = require('es6-promise-pool');
const {ipcRenderer} = require('electron');

// TODO: set num by isDev
const CONCURRENT = 7;

/**
 * Returns a pool of modifiers to run.
 * @param {!Library} library Library to modify.
 * @param {!Array<T>} items Array of items to modify.
 * @param {string} prefix An identifying string to use as a prefix in html.
 * @param {!function(T):string} getName A function that takes int he item to
 *  modify and returns its name
 * @param {!function(T):Promise} modifyFunc The modification function to run.
 * @return {!PromisePool} The pool to run
 */
function getPool(library, items, prefix, getName, modifyFunc) {
  let index = 0;
  ipcRenderer.send('extension-update', {
    'type': 'start-section',
    'items': items.length,
  });
  return new PromisePool(() => {
    const item = items[index];
    if (!item) {
      return null;
    }
    const id = index++;
    const name = getName(item);
    ipcRenderer.send('extension-update', {
      'type': 'start-item',
      'id': prefix + id,
      name,
    });
    return modifyFunc(item, library).then(() => {
      ipcRenderer.send('extension-update', {
        'type': 'end-item',
        'id': prefix + id,
        name,
      });
    });
  }, CONCURRENT);
}

/**
 * Gets a promise pool of album modifications.
 * @param {!Libray} library The library to modify.
 * @return {!PromisePool} The pool to run.
 */
function getAlbumsPool(library) {
  return getPool(
    library,
    library.getAlbums(),
    /* prefix= */ 'album-',
    (album) => {
      const artist = library.getArtistsByIds(album.artistIds)
        .map((artistData) => artistData.name)
        .join(", ");
      return album.name + "by: " + artist;
    },
    modifyAlbum
  );
}

/**
 * Gets a promise pool of artist modifications.
 * @param {!Library} library The library rto modify.
 * @return {!PromisePool} The pool to run.
 */
function getArtistPool(library) {
  return getPool(
    library,
    library.getArtists(),
    /* prefix= */ 'artist-',
    (artist) => {
      return artist.name;
    },
    modifyArtist
  );
}

/**
 * Runs the entire wikipedia extension.
 * @param {!Library} library The library to modify.
 * @return {!Promise} A promise resolving once finished.
 */
export default function runWikiExtension(library) {
  const albumPool = getAlbumsPool(library);
  const artistPool = getArtistPool(library);
  return albumPool.start()
    .then(() => artistPool.start())
    .then(() => {
      ipcRenderer.send('extension-update', {
        'type': 'done',
      });
    });
}
