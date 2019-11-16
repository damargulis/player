import {BASE_URL} from './constants';
import {
  GENRE_ERROR,
  NO_PAGE_ERROR,
  PARSER_ERROR,
  PIC_ERROR,
} from './errors';
import {findAsync, getDoc, getGenresByRow} from './utils';

const rp = require('request-promise-native');
const fs = require('fs');
const shortid = require('shortid');


/**
 * Returns all possible wikipedia link names for an artist.
 * @param {!Artist} artist The artist to search for.
 * @return {!Array<string>} The possible page links.
 */
function getWikiPageOptions(artist) {
  const artistName = artist.name.replace(/ /g, '_');
  return [
    BASE_URL + artistName,
    BASE_URL + artistName + "_(band)",
    BASE_URL + artistName + "_(musician)",
    BASE_URL + artistName + "_(singer)",
  ];
}

/**
 * Checks if a link might be the correct album link.
 * @param {!string} link The link to check.
 * @return {boolean} True if it could be the correct link.
 */
function isRightLink(link) {
  return rp(link).then((htmlString) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const infoBoxes = doc.getElementsByClassName('infobox');
    const infoBox = infoBoxes[0];
    if (infoBox && (infoBox.textContent.includes(
      "Background information") || infoBox.textContent.includes(
      "Musical career"))) {
      return true;
    }
    if (infoBox && infoBox.textContent.includes("Genres") &&
      infoBox.textContent.includes("Years active") &&
      infoBox.textContent.includes("Associated acts")) {
      return true;
    }
    return false;
  }).catch(() => {
    return false;
  });
}

/**
 * Search through possible options for the wiki page of the artist.
 * @param {!Artist} artist The artist to search for.
 * @return {!Promise<string>} A promise which resolves with the link to the
 * artists wiki page.
 */
function searchForWikiPage(artist) {
  const options = getWikiPageOptions(artist);
  return findAsync(options, (option) => {
    return isRightLink(option, artist);
  });
}

/**
 * Runs the extension to modify an artist with the wikipedia data. Will try to
 * find a wikipedia page if one doesn't already exist.
 * @param {!Artist} artist The artist to modify.
 * @param {!Library} library The base library to modify.
 * @return {!Promise} A promise that resolves once finished.
 */
function modifyArtist(artist, library) {
  return rp(artist.wikiPage).then((htmlString) => {
    artist.removeError(PARSER_ERROR);
    const doc = getDoc(htmlString);
    const infoBoxes = doc.getElementsByClassName('infobox');
    const infoBox = infoBoxes[0];
    const rows = infoBox.getElementsByTagName('tr');
    const genres = getGenresByRow(rows);
    if (genres && genres.length) {
      artist.genreIds = library.getGenreIds(genres);
      artist.removeError(GENRE_ERROR);
    } else {
      artist.addError(GENRE_ERROR);
    }
    const pics = infoBox.getElementsByTagName('img');
    //TODO: take multiple pictures (rotate them elsewhere in the app)
    const pic = pics[0];
    const options = {
      url: pic && pic.src,
      encoding: 'binary',
    };
    return rp(options).then((data) => {
      if (!artist.artFile) {
        const id = shortid.generate();
        artist.artFile = './data/' + id + '.png';
      }
      fs.writeFileSync(artist.artFile, data, 'binary');
      // should this even be an error?
      artist.removeError(PIC_ERROR);
    }).catch(() => {
      artist.addError(PIC_ERROR);
      return Promise.resolve();
    });
  }).catch(() => {
    artist.addError(PARSER_ERROR);
    return Promise.resolve();
  });
}

/**
 * Runs the extension to modify an artist with the wikipedia data. Will try to
 * find a wikipedia page if one doesn't already exist.
 * @param {!Album} artist The album to modify
 * @param {!Library} library The base library to modify.
 * @return {!Promise} A promise that resolves once finished.
 */
export default function runArtistModifier(artist, library) {
  if (!artist.wikiPage) {
    return searchForWikiPage(artist, library).then((wikiPage) => {
      if (wikiPage) {
        artist.removeError(NO_PAGE_ERROR);
        artist.wikiPage = wikiPage;
        return modifyArtist(artist, library);
      }
      artist.addError(NO_PAGE_ERROR);
      return Promise.resolve();
    });
  }
  return modifyArtist(artist, library);
}
