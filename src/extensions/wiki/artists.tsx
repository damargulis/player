import Artist from '../../library/Artist';
import {DATA_DIR} from '../../constants';
import {BASE_URL} from './constants';
import {GENRE_ERROR, NO_PAGE_ERROR, PARSER_ERROR, PIC_ERROR} from './errors';
import fs from 'fs';
import rp from 'request-promise-native';
import {getGenreIds} from '../../redux/selectors';
import shortid from 'shortid';
import {RootState} from '../../redux/store';
import {findAsync, getDoc, getGenresByRow} from './utils';

function getWikiPageOptions(artist: Artist): string[] {
  const artistName = artist.name.replace(/ /g, '_');
  return [
    `${BASE_URL}${artistName}`,
    `${BASE_URL}${artistName}_(band)`,
    `${BASE_URL}${artistName}_(musician)`,
    `${BASE_URL}${artistName}_(singer)`,
  ];
}

function isRightLink(link: string): Promise<boolean> {
  return rp(link).then((htmlString: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const infoBoxes = doc.getElementsByClassName('infobox');
    const infoBox = infoBoxes[0];
    if (infoBox && infoBox.textContent &&  (infoBox.textContent.includes(
      'Background information') || infoBox.textContent.includes(
      'Musical career'))) {
      return true;
    }
    if (infoBox && infoBox.textContent && infoBox.textContent.includes('Genres') &&
      infoBox.textContent.includes('Years active') &&
      infoBox.textContent.includes('Associated acts')) {
      return true;
    }
    return false;
  }).catch(() => {
    return false;
  });
}

function searchForWikiPage(artist: Artist): Promise<string>  {
  const options = getWikiPageOptions(artist);
  return findAsync(options, (option: string) => {
    return isRightLink(option);
  });
}

function modifyArtist(store: RootState, artist: Artist): Promise<void> {
  if (!artist.wikiPage) {
    return Promise.resolve();
  }
  return rp(artist.wikiPage).then((htmlString: string) => {
    artist.removeError(PARSER_ERROR);
    const doc = getDoc(htmlString);
    const infoBoxes = doc.getElementsByClassName('infobox');
    const infoBox = infoBoxes[0];
    const rows = infoBox.getElementsByTagName('tr');
    const genres = getGenresByRow(rows);
    if (genres && genres.length) {
      artist.genreIds = getGenreIds(store, genres);
      artist.removeError(GENRE_ERROR);
    } else {
      artist.addError(GENRE_ERROR);
    }
    const pics = infoBox.getElementsByTagName('img');
    // TODO: take multiple pictures (rotate them elsewhere in the app)
    const pic = pics[0];
    let picURL = '';
    if (pic && pic.src) {
      const url = new URL(pic.src);
      url.protocol = 'https://';
      picURL = url.toString();
    }
    const options = {
      encoding: 'binary',
      url: picURL,
    };
    return rp(options).then((data: string) => {
      if (!artist.artFile) {
        const id = shortid.generate();
        artist.artFile = `${DATA_DIR}/${id}.png`;
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

export default function runArtistModifier(store: RootState, artist: Artist): Promise<void> {
  if (!artist.wikiPage) {
    return searchForWikiPage(artist).then((wikiPage) => {
      if (wikiPage) {
        artist.removeError(NO_PAGE_ERROR);
        artist.wikiPage = wikiPage;
        return modifyArtist(store, artist);
      }
      artist.addError(NO_PAGE_ERROR);
      return Promise.resolve();
    });
  }
  return modifyArtist(store, artist);
}