const rp = require('request-promise-native');
const PromisePool = require('es6-promise-pool');
const moment = require('moment');
const fs = require('fs');
const shortid = require('shortid');

const BASE_URL = "https://en.wikipedia.org/api/rest_v1/page/html/";

/**
 * Removes any text between parenthesis and turn any extra
 * whitespace into a regular space.
 * @param {string} string The string to sanitize.
 * @return {string} The sanitized string.
 */
function sanitize(string) {
  return string.replace(/\s*\[.*?\]\s*/g, "").replace(/\s+/g, " ");
}

/**
 * Gets an array of all leaf nodes given a root node.
 * @param {!Node} rootNode The root node to find all leafs for.
 * @return {!Array<!Node>} All the leaf nodes.
 */
function getLeafNodes(rootNode) {
  if (rootNode.childNodes.length > 0) {
    const children = [];
    for (let ind = 0; ind < rootNode.childNodes.length; ind++) {
      children.push(...getLeafNodes(rootNode.childNodes[ind]));
    }
    return children;
  }
  return [rootNode];
}

/**
 * Gets the year from a year node on a wiki page.
 * @param {!Node} rootNode The root node of the year data.
 * @return {number} The year of the album.
 */
function getYear(rootNode) {
  const released = rootNode.textContent;
  let str = sanitize(released);
  if (str.indexOf("(") > 0) {
    str = str.slice(0, str.indexOf("("));
  }
  const time = moment(str);
  return time.year()
}

/**
 * Gets the genres from a genre node on a wiki page.
 * @param {!Node} rootNode The root node of the genre data.
 * @return {!Array<string>} A list of the genres for the album.
 */
function getGenres(rootNode) {
  const leafNodes = getLeafNodes(rootNode);
  // filter out ", ", " ", ".", and any other weird symbols that might be
  // accidental
  const textNodes = leafNodes.filter(
    (node) => node.textContent && node.textContent.length > 2);
  const text = textNodes.map((node) => sanitize(node.textContent))
  return text.map((genre) => formatGenre(genre)).filter(Boolean);

}

/**
 * Capitalizes a word.
 * @param {string} word The word to capitalize.
 * @return {string} The capitalized word.
 */
function capitalize(word) {
  if (word === "and") {
    return word;
  }
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Formats a wikipedia genre string into a comma separated list.
 * @param {string} genre The genre string as parsed from wikipedia.
 * @return {!Array<string>} List of genres found.
 */
function formatGenre(genre) {
  const genreString = genre.trim().split(' ').map(
    (word) => capitalize(word)).join(' ');
  return genreString.split('-').map((word) => capitalize(word)).join('-');
}

/**
 * Returns all possible wikipedia link names.
 * @param {!Album} album The album to generate names for.
 * @param {!Artist} artist The artist to generate names for.
 * @return {!Array<string>} The possible wikipedia page links.
 */
function getAllWikiOptions(album, artist) {
  const albumName = album.name.replace(/ /g, "_");
  const artistName = artist.name.replace(/ /g, "_");
  return [
    BASE_URL + albumName,
    BASE_URL + albumName + "_(album)",
    BASE_URL + albumName + "_(" + artistName + "_album)",
    BASE_URL + albumName + "_(EP)",
    BASE_URL + albumName + "_(mixtape)",
    BASE_URL + albumName + "_(song)",
    BASE_URL + albumName + "_(" + artistName + "_song)",
    BASE_URL + albumName + "_(" + artistName + "_mixtape)",
    BASE_URL + albumName + "_(" + artistName + "_EP)"
  ];
}

/**
 * TODO: should do this by prio not just fastest? -- otherwise need the
 * isRightLInk check to be better
 * Similar to Array.find() but runs async.
 * @param {!Array<!T>} arr The array to run find on.
 * @param {!Function} asyncCallback The async callback to run, should
 *  return a boolean.
 * @return {T} The first one to return true
 */
async function findAsync(arr, asyncCallback) {
  const promises = arr.map(asyncCallback);
  const results = await Promise.all(promises);
  const index = results.findIndex(result => result);
  return arr[index];
}

/**
 * Checks if a link might be the correct album link.
 * @param {!string} link The link to check.
 * @param {!Album} album The album to check for.
 * @param {!Artist} artist The artist to check for.
 * @return {boolean} True if it could be the correct link.
 */
function isRightLink(link, album, artist) {
  return rp(link).then((htmlString) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const infoBoxes = doc.getElementsByClassName('infobox');
    const infoBox = infoBoxes[0];
    return infoBox && infoBox.textContent.toLowerCase().includes(
      "by " + artist.name.toLowerCase());
  }).catch(() => {
    return false;
  });
}

/**
 * Searches for a potenetial wikipedia page for an album.
 * @param {!Album} album The album to search for.
 * @param {!Library} library The library the album is from.
 * @return {string} The best guess wikipedia page.
 */
function searchForWikiPage(album, library) {
  const artist = library.getArtistsByIds(album.artistIds)[0];
  const options = getAllWikiOptions(album, artist);
  const correct = findAsync(options, (option) => {
    return isRightLink(option, album, artist);
  });
  return correct;
}

/**
 * Runs the extension to modify an album with the wikipedia data. Will try to
 * find a wikipedia page if one doesn't already exist.
 * @param {!Album} album The album to modify
 * @param {!Library} library The base library to modify.
 * @return {!Promise} A promise that resolves once finished.
 */
function modifyAlbum(album, library) {
  if (!album.wikiPage) {
    album.wikiPage = searchForWikiPage(album, library);
  }
  if (album.wikiPage) {
    return rp(album.wikiPage).then((htmlString) => {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        const infoBoxes = doc.getElementsByClassName('infobox');
        const infoBox = infoBoxes[0];
        const rows = infoBox.getElementsByTagName('tr');
        for (const row of rows) {
          try {
            const headers = row.getElementsByTagName('th');
            const name = headers[0] && headers[0].textContent;
            const data = row.getElementsByTagName('td')[0];
            switch (name) {
            case 'Genre':
              album.genreIds = library.getGenreIds(getGenres(data));
              break;
            case 'Released':
              album.year = getYear(data);
              break;
            default:
              break;
            }
          } catch (err) {
            // handled

          }
        }

        const pics = infoBox.getElementsByTagName('img');
        //TODO: take multiple pictures (rotate them elsewhere in the app)
        const pic = pics[0];
        const options = {
          url: pic.src,
          encoding: 'binary',
        }
        return rp(options).then((data) => {
          if (!album.albumArtFile) {
            const id = shortid.generate()
            album.albumArtFile = './data/' + id + '.png';
          }
          fs.writeFile(album.albumArtFile, data, 'binary');
        });
      } catch (err) {
        // TODO: add error to album on each error -- make each error different
        // possible all at once
        return err;
      }
    }).catch(() => {
      // TODO: add error to album for no wiki page
    });
  }
  return Promise.resolve();
}

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
    const album = albums[index];
    index++;
    if (!album) {
      return null
    }
    return modifyAlbum(album, library);
  }, /* numConcurrent= */ 1);
  return pool.start();
}
