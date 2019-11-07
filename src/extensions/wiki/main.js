import modifyAlbum from './albums';
import modifyArtist from './artists';
const PromisePool = require('es6-promise-pool');

/**
 * Runs the wikipedia extension against an entire library.
 * @param {!Library} library The library to run wiki extension on.
 * @return {!Promise} A promise which resolve when the extension has finished.
 */
export default function runWikiExtension(library) {
  const albums = library.getAlbums()
  let index = 0;
  // set up debug mode -- 1 when in debug, then either const or some func
  // based on comp/network
  const pool = new PromisePool(() => {
    return null;
    const album = albums[index];
    index++;
    if (!album) {
      return null
    }
    return modifyAlbum(album, library);
  }, /* numConcurrent= */ 10);
  return pool.start().then(() => {
    const artists = library.getArtists();
    let artistIndex = 0;
    const artistPool = new PromisePool(() => {
      const artist = artists[artistIndex];
      artistIndex++;
      if (!artist) {
        return null;
      }
      return modifyArtist(artist, library);
    }, /* numConcurrent= */ 10);
    return artistPool.start();
  });
}
