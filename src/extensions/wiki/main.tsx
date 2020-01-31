import {Album, AlbumInfo, Artist, ArtistInfo, LibraryState} from '../../redux/actionTypes';
import modifyAlbum from './albums';
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

function getAlbumsPool(store: RootState, albums: Album[]): PromisePool<AlbumInfo | void> {
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

export default function runWikiExtension(store: RootState): PromiseLike<LibraryState> {
  // put these into a single pool so that you can go straight into the other
  // without having to wait for an acutal finish?
  const albums = getAlbumsByIds(store, getAllAlbumIds(store));
  const artists = getArtistsByIds(store, getAllArtistIds(store));
  const albumPool = getAlbumsPool(store, albums);
  const artistPool = getArtistPool(store, artists);
  const albumErrors = albums.reduce((total: number, album: Album) => total + album.errors.length, 0);
  const albumWarnings = albums.reduce(
    (total: number, album: Album) => total + Object.keys(album.warnings).length, 0);
  const albumGood = albums.filter((album: Album) => {
    return album.errors.length === 0 &&
      Object.keys(album.warnings).length === 0;
  }).length;
  const albumMap = albums.reduce((map, curr) => { map[curr.id] = curr; return map; }, {} as Record<string, Album>);
  const artistMap = artists.reduce((map, curr) => { map[curr.id] = curr; return map; }, {} as Record<string, Artist>);
  // TODO: at the end, you should be given a clickthrough with all wanrings to accept / reject?
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
      return {
        tracks: {...store.library.tracks},
        albums: {...albumMap},
        artists: {...artistMap},
        genres: {...store.library.genres},
        playlists: {...store.library.playlists},
      };
    });
}
