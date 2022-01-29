import {Album, AlbumInfo, Artist, ArtistInfo, LibraryInfo} from '../../redux/actionTypes';
import modifyAlbum from './albums';
import modifyArtist from './artists';
import {ipcRenderer} from 'electron';
import PromisePool from 'es6-promise-pool';
import {getAlbumsByIds, getArtistsByIds} from '../../redux/selectors';
import shortid from 'shortid';
import {RootState} from '../../redux/store';
import {getPool} from '../utils';

function plural<T>(array: T[]): string {
  if (array.length === 1) {
    return 's';
  }
  return '';
}

function getAlbumsPool(store: RootState, albums: Album[], extId: string): PromisePool<AlbumInfo | void> {
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
    extId,
  );
}

function getArtistPool(store: RootState, artists: Artist[], extId: string): PromisePool<ArtistInfo | void> {
  return getPool(
    store,
    artists,
    /* prefix= */ 'artist-',
    (artist) => {
      return artist.name;
    },
    modifyArtist,
    extId,
  );
}

export default function runWikiExtension(
  albumIds: string[], artistIds: string[], store: RootState): PromiseLike<LibraryInfo> {
  // put these into a single pool so that you can go straight into the other
  // without having to wait for an acutal finish?
  const extId = shortid.generate();
  const albums = getAlbumsByIds(store, albumIds);
  const artists = getArtistsByIds(store, artistIds);
  const albumPool = getAlbumsPool(store, albums, extId);
  const artistPool = getArtistPool(store, artists, extId);
  const albumMap = albums.reduce((map, curr) => { map[curr.id] = curr; return map; }, {} as Record<string, Album>);
  const artistMap = artists.reduce((map, curr) => { map[curr.id] = curr; return map; }, {} as Record<string, Artist>);
  // TODO: at the end, you should be given a clickthrough with all wanrings to accept / reject?
  return albumPool.start()
    .then(() => artistPool.start())
    .then(() => {
      // TODO:redo
      // const albumsWithWarnings = albums.filter((album) => Object.values(album.warnings).length !== 0).length;
      const albumsWithErrors = albums.filter((album) => album.errors.length !== 0).length;
      const artistsWithErrors = artists.filter((artist) => artist.errors.length !== 0).length;
      const msg = `Wikipedia Modifier Completed.<br>
        ${albums.length} album${plural(albums)} modified.<br>
        ${albumsWithErrors} with errors.<br>
        <br>
        ${artists.length} artist${plural(artists)} modified.<br>
        ${artistsWithErrors} with  errors.<br>
      `;
      ipcRenderer.send('extension-update', {
        msg,
        type: 'done',
        extensionId: extId,
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
