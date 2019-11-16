import {BASE_URL} from './constants';
import {
  ALBUM_ART_ERROR,
  GENRE_ERROR,
  NO_PAGE_ERROR,
  PARSER_ERROR,
  YEAR_ERROR
} from './errors';
import {findAsync, getDoc, getGenresByRow, sanitize} from './utils';

const rp = require('request-promise-native');
const moment = require('moment');
const fs = require('fs');
const shortid = require('shortid');

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
  return time.year();
}

/**
 * Gets the release year found in the infobox.
 * @param {!Array<!HTMLNode>} rows The rows of a wikipedia infobox.
 * @return {?number} The first release year found, or null if none is found.
 */
function getYearByRow(rows) {
  for (const row of rows) {
    const headers = row.getElementsByTagName('th');
    const name = headers[0] && headers[0].textContent;
    if (name === "Released") {
      const data = row.getElementsByTagName('td')[0];
      return getYear(data);
    }
  }
  return null;
}

/**
 * Returns all possible wikipedia link names.
 * @param {!Album} album The album to generate names for.
 * @param {!Artist} artist The artist to generate names for.
 * @return {!Array<string>} The possible wikipedia page links.
 */
function getAllWikiOptions(album, artist) {
  const albumName = album.name.replace('#', 'Number ').replace(/ /g, "_");
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
    BASE_URL + albumName + "_(" + artistName + "_EP)",
    BASE_URL + albumName + "_(" + album.year + "_album)",
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
 * Modifys an album based on the data found on its wikipedia page.
 * @param {!Album} album The album to modify.
 * @param {!Library} library The library the album is from.
 * @return {!Promise} A promise resolving once finished.
 */
function modifyAlbum(album, library) {
  return rp(album.wikiPage).then((htmlString) => {
    album.removeError(PARSER_ERROR);
    const doc = getDoc(htmlString);
    const infoBoxes = doc.getElementsByClassName('infobox');
    const infoBox = infoBoxes[0];
    const rows = infoBox.getElementsByTagName('tr');
    const year = getYearByRow(rows);
    if (year) {
      album.year = year;
      album.removeError(YEAR_ERROR);
    } else {
      album.addError(YEAR_ERROR);
    }
    const genres = getGenresByRow(rows);
    if (genres && genres.length) {
      album.genreIds = library.getGenreIds(genres);
      album.removeError(GENRE_ERROR);
    } else {
      album.addError(GENRE_ERROR);
    }

    const pics = infoBox.getElementsByTagName('img');
    //TODO: take multiple pictures (rotate them elsewhere in the app)
    const pic = pics[0];
    const options = {
      url: pic && pic.src,
      encoding: 'binary',
    };
    return rp(options).then((data) => {
      if (!album.albumArtFile) {
        const id = shortid.generate();
        album.albumArtFile = './data/' + id + '.png';
      }
      fs.writeFileSync(album.albumArtFile, data, 'binary');
      album.removeError(ALBUM_ART_ERROR);
    }).catch(() => {
      album.addError(ALBUM_ART_ERROR);
      return Promise.resolve();
    });
  }).catch(() => {
    album.addError(PARSER_ERROR);
    return Promise.resolve();
  });
}

/**
 * Runs the extension to modify an album with the wikipedia data. Will try to
 * find a wikipedia page if one doesn't already exist.
 * @param {!Album} album The album to modify
 * @param {!Library} library The base library to modify.
 * @return {!Promise} A promise that resolves once finished.
 */
export default function runAlbumModifier(album, library) {
  if (!album.wikiPage) {
    return searchForWikiPage(album, library).then((wikiPage) => {
      if (wikiPage) {
        album.removeError(NO_PAGE_ERROR);
        album.wikiPage = wikiPage;
        return modifyAlbum(album, library);
      }
      // add error for no wiki page
      album.addError(NO_PAGE_ERROR);
      return Promise.resolve();
    });
  }
  return modifyAlbum(album, library);
}

