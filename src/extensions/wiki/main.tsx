import {AlbumInfo, AlbumParams, Artist, ArtistInfo} from '../../redux/actionTypes';
import modifyAlbum from './albums';
import modifyArtist from './artists';
import {ipcRenderer} from 'electron';
import PromisePool from 'es6-promise-pool';
import Library from '../../library/Library';
import {getAlbumsByIds, getAllAlbumIds, getAllArtistIds, getArtistsByIds} from '../../redux/selectors';
import {RootState} from '../../redux/store';

// TODO: set num by isDev
const CONCURRENT = 7;

/** Returns a pool of modifiers to run. */
function getPool<T>(
  store: RootState,
  items: T[],
  prefix: string,
  getName: (item: T) =>  string,
  modifyFunc: (store: RootState, item: T) =>  Promise<object>,
): PromisePool<void | T> {
  let index = 0;
  ipcRenderer.send('extension-update', {
    items: items.length,
    type: 'start-section',
  });
  return new PromisePool<void | T>(() => {
    const item = items[index];
    if (!item) {
      return;
    }
    const id = index++;
    const name = getName(item);
    ipcRenderer.send('extension-update', {
      id: prefix + id,
      name,
      type: 'start-item',
    });
    return modifyFunc(store, item).then(() => {
      ipcRenderer.send('extension-update', {
        id: prefix + id,
        name,
        type: 'end-item',
      });
      return {...item};
    });
  }, CONCURRENT);
}

function getAlbumsPool(store: RootState, albums: AlbumParams[]): PromisePool<AlbumInfo | void> {
  return getPool(
    store,
    albums,
    /* prefix= */ 'album-',
    (album) => {
      const artist = getArtistsByIds(store, album.artistIds)
        .map((artistData: Artist) => artistData.name)
        .join(', ');
      return `${album.name} by: ${artist}`;
    },
    modifyAlbum,
  );
}

function getArtistPool(store: RootState, artists: Artist[]): PromisePool<ArtistInfo | void> {
  return getPool(
    store,
    artists,
    /* prefix= */ 'artist-',
    (artist) => {
      return artist.name;
    },
    modifyArtist,
  );
}

export default function runWikiExtension(store: RootState): PromiseLike<Library> {
  // put these into a single pool so that you can go straight into the other
  // without having to wait for an acutal finish?
  const albums = getAlbumsByIds(store, getAllAlbumIds(store));
  const artists = getArtistsByIds(store, getAllArtistIds(store));
  const albumPool = getAlbumsPool(store, albums);
  const artistPool = getArtistPool(store, artists);
  const albumErrors = albums.reduce((total: number, album: AlbumParams) => total + album.errors.length, 0);
  const albumWarnings = albums.reduce(
    (total: number, album: AlbumParams) => total + Object.keys(album.warnings).length, 0);
  const albumGood = albums.filter((album: AlbumParams) => {
    return album.errors.length === 0 &&
      Object.keys(album.warnings).length === 0;
  }).length;
  return albumPool.start()
    .then(() => artistPool.start())
    .then(() => {
      ipcRenderer.send('extension-update', {
        albumErrors,
        albumGood,
        albumWarnings,
        type: 'done',
      });
    }).then(() => {
      return new Library(
        [...store.library.tracks],
        [...albums],
        [...artists],
        [...store.library.genres],
        [...store.library.playlists]
      );
    });
}
