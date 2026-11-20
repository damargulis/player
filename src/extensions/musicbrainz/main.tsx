import {Album, AlbumInfo, Artist, ArtistInfo, LibraryInfo} from '../../redux/actionTypes';
import modifyAlbum from './albums';
import modifyArtist from './artists';
import {runDelta, startRun} from '../delta';
import {ipcRenderer} from 'electron';
import PromisePool from 'es6-promise-pool';
import {getAlbumsByIds, getArtistsByIds, getTracksByIds} from '../../redux/selectors';
import shortid from 'shortid';
import {RootState} from '../../redux/store';
import {getPool} from '../utils';

function plural<T>(array: T[]): string {
  return array.length === 1 ? '' : 's';
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

export default function runMusicBrainzExtension(
  albumIds: string[], artistIds: string[], store: RootState,
  sharedId?: string): PromiseLike<LibraryInfo> {
  // A grouped run supplies one id so every step reports into a single monitor window.
  const extId = sharedId || shortid.generate();
  const albums = getAlbumsByIds(store, albumIds);
  const artists = getArtistsByIds(store, artistIds);
  const albumPool = getAlbumsPool(store, albums, extId);
  const artistPool = getArtistPool(store, artists, extId);
  // the album runs also write their tracks' genres, years and name hints
  const tracks = getTracksByIds(store, ([] as string[]).concat(...albums.map((album) => album.trackIds)));
  const start = startRun(albums, artists, tracks, store.library.genres);
  return albumPool.start()
    .then(() => artistPool.start())
    .then(() => {
      const albumsWithErrors = albums.filter((album) => album.errors.length !== 0).length;
      const artistsWithErrors = artists.filter((artist) => artist.errors.length !== 0).length;
      const msg = `MusicBrainz Modifier Completed.<br>
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
    }).then(() => runDelta(start, albums, artists, tracks, store.library.genres));
}
