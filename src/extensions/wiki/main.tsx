import Album from '../../library/Album';
import Artist from '../../library/Artist';
import Library from '../../library/Library';
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
function getPool<T>(library: Library, items: T[], prefix: string, getName: (item: T) =>  string, modifyFunc: (item: T, library: Library) =>  Promise<null>) {
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

function getAlbumsPool(library: Library) {
  return getPool(
    library,
    library.getAlbums(),
    /* prefix= */ 'album-',
    (album) => {
      const artist = library.getArtistsByIds(album.artistIds)
        .map((artistData: Artist) => artistData.name)
        .join(", ");
      return album.name + " by: " + artist;
    },
    modifyAlbum
  );
}

function getArtistPool(library: Library) {
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

export default function runWikiExtension(library: Library) {
  // put these into a single pool so that you can go straight into the other
  // without having to wait for an acutal finish?
  const albumPool = getAlbumsPool(library);
  const artistPool = getArtistPool(library);
  const albumErrors = library.getAlbums()
    .reduce((total: number, album: Album) => total + album.errors.length, 0);
  const albumWarnings = library.getAlbums()
    .reduce((total: number, album: Album) => total + Object.keys(album.warnings).length, 0);
  const albumGood = library.getAlbums().filter((album: Album) => {
    return album.errors.length === 0 &&
      Object.keys(album.warnings).length === 0;
  }).length;
  return albumPool.start()
    .then(() => artistPool.start())
    .then(() => {
      ipcRenderer.send('extension-update', {
        'type': 'done',
        albumErrors,
        albumWarnings,
        albumGood,
      });
    });
}
