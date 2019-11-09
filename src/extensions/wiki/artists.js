import {getGenres, findAsync} from './utils';

const rp = require('request-promise-native');
const fs = require('fs');
const shortid = require('shortid');


// TODO: move to common constants
const BASE_URL = "https://en.wikipedia.org/api/rest_v1/page/html/";

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

function searchForWikiPage(artist, library) {
  const options = getWikiPageOptions(artist);
  return findAsync(options, (option) => {
    return isRightLink(option, artist);
  });
}

export default async function modifyArtist(artist, library) {
  // for art, cycle through all pics found on page??
  // TODO: add artist.wikiPage to library
  if (!artist.wikiPage) {
    artist.wikiPage = await searchForWikiPage(artist, library);
  }
  if (!artist.wikiPage) {
    artist.errors.push("No Wiki Page Found");
    console.log('no wiki page for ' + artist.name);
    return null;
  }
  return rp(artist.wikiPage).then((htmlString) => {
    console.log(artist.wikiPage);
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
            debugger;
            console.groupCollapsed("Changing artist genres for: " + artist.name);
            // instead of change, add?
            console.log(library.getGenresByIds(artist.genreIds));
            artist.genreIds = library.getGenreIds(getGenres(data));
            console.log(library.getGenresByIds(artist.genreIds));
            console.groupEnd();
            break;
          default:
            break;
        }
      } catch (err) {
        console.log('non fatel error on: ' + artist.name);
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
    }).catch((err) => {
      console.log("error creating artist pic?");
      console.log(err);
    });
  }).catch((err) => {
    console.log("other error?");
    console.log(err);
  });
}
