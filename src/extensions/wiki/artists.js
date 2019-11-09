import {findAsync, getGenres} from './utils';

const rp = require('request-promise-native');
const fs = require('fs');
const shortid = require('shortid');


// TODO: move to common constants
const BASE_URL = "https://en.wikipedia.org/api/rest_v1/page/html/";

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
    return infoBox && (infoBox.textContent.includes(
      "Background information") || infoBox.textContent.includes(
      "Musical career"));
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
export default async function modifyArtist(artist, library) {
  // for art, cycle through all pics found on page??
  // TODO: add artist.wikiPage to library
  if (!artist.wikiPage) {
    artist.wikiPage = await searchForWikiPage(artist, library);
  }
  if (!artist.wikiPage) {
    artist.errors.push("No Wiki Page Found");
    return null;
  }
  return rp(artist.wikiPage).then((htmlString) => {
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
        case 'Genres':
          // TODO: decide - instead of change, add?
          artist.genreIds = library.getGenreIds(getGenres(data));
          break;
        default:
          break;
        }
      } catch (err) {
        artist.errors.push("non fatel: " + err);
      }
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
    }).catch(() => {
      artist.errors.push("Fetching art failed");
    });
  }).catch(() => {
    artist.errors.push("fetching wiki page failed");
    // TODO: handle error
  });
}
