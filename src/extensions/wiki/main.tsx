import Album from '../../library/Album';
import modifyAlbum from './albums';
import Artist from '../../library/Artist';
import modifyArtist from './artists';
import {ipcRenderer} from 'electron';
import PromisePool from 'es6-promise-pool';
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
  modifyFunc: (store: RootState, item: T) =>  Promise<void>,
): PromisePool<void> {
  let index = 0;
  ipcRenderer.send('extension-update', {
    items: items.length,
    type: 'start-section',
  });
  return new PromisePool(() => {
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
    });
  }, CONCURRENT);
}

function getAlbumsPool(store: RootState, albums: Album[]): PromisePool<void> {
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

function getArtistPool(store: RootState, artists: Artist[]): PromisePool<void> {
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

export default function runWikiExtension(store: RootState): PromiseLike<void> {
  // put these into a single pool so that you can go straight into the other
  // without having to wait for an acutal finish?
  const albums = getAlbumsByIds(store, getAllAlbumIds(store));
  const artists = getArtistsByIds(store, getAllArtistIds(store));
  const albumPool = getAlbumsPool(store, albums);
  const artistPool = getArtistPool(store, artists);
  const albumErrors = albums.reduce((total: number, album: Album) => total + album.errors.length, 0);
  const albumWarnings = albums.reduce((total: number, album: Album) => total + Object.keys(album.warnings).length, 0);
  const albumGood = albums.filter((album: Album) => {
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
    });
}