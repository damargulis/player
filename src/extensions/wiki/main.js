import modifyAlbum from './albums';
import modifyArtist from './artists';
const PromisePool = require('es6-promise-pool');
const {ipcRenderer} = require('electron');

const CONCURRENT = 7;

/**
 * Runs the wikipedia extension against an entire library.
 * @param {!Library} library The library to run wiki extension on.
 * @return {!Promise} A promise which resolve when the extension has finished.
 */
export default function runWikiExtension(library) {
  const albums = library.getAlbums();
  let index = 0;
  let finished = 0;
  // set up debug mode -- 1 when in debug, then either const or some func
  // based on comp/network
  const pool = new PromisePool(() => {
    const album = albums[index];
    if (!album) {
      return null;
    }
    const id = index++;
    const artist = library.getArtistsByIds(album.artistIds)
      .map((artistData) => artistData.name)
      .join(", ");
    ipcRenderer.send('extension-update', {
      'type': 'start-album',
      'name': album.name,
      id,
      artist,
    });
    return modifyAlbum(album, library).then(() => {
      finished++;
      ipcRenderer.send('extension-update', {
        'type': 'end-album',
        id,
        'percent': finished / albums.length * 100,
      });
    });
  }, CONCURRENT);
  return pool.start().then(() => {
    const artists = library.getArtists();
    let artistIndex = 0;
    let artistsFinished = 0;
    const artistPool = new PromisePool(() => {
      const artist = artists[artistIndex];
      if (!artist) {
        return null;
      }
      const artistId = artistIndex++;
      ipcRenderer.send('extension-update', {
        'type': 'start-artist',
        'name': artist.name,
        'id': artistId,
      });
      return modifyArtist(artist, library).then(() => {
        artistsFinished++;
        ipcRenderer.send('extension-update', {
          'type': 'end-artist',
          'id': artistId,
          'percent': artistsFinished / artists.length * 100,
        });
      });
    }, CONCURRENT);
    return artistPool.start().then(() => {
      ipcRenderer.send('extension-update', {
        'type': 'done',
      });
    });
  });
}
