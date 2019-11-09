import {findAsync, getGenres, sanitize} from './utils';

const rp = require('request-promise-native');
const moment = require('moment');
const fs = require('fs');
const shortid = require('shortid');


const BASE_URL = "https://en.wikipedia.org/api/rest_v1/page/html/";

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
  return findAsync(options, (option) => {
    return isRightLink(option, album, artist);
  });
}

/**
 * Runs the extension to modify an album with the wikipedia data. Will try to
 * find a wikipedia page if one doesn't already exist.
 * @param {!Album} album The album to modify
 * @param {!Library} library The base library to modify.
 * @return {!Promise} A promise that resolves once finished.
 */
export default async function modifyAlbum(album, library) {
  if (!album.wikiPage) {
    album.wikiPage = await searchForWikiPage(album, library);
  }
  if (album.wikiPage) {
    return rp(album.wikiPage).then((htmlString) => {
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
          album.errors.push("Non fatal: " + err);
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
        fs.writeFileSync(album.albumArtFile, data, 'binary');
      });
    }).catch(() => {
      album.errors.push("Wikipedia: Parsing error");
    });
  } 
  album.errors.push("No wiki page found");
  return Promise.resolve();
}
