import {Artist, ArtistInfo} from '../../redux/actionTypes';
import {DATA_DIR} from '../../constants';
import {BASE_URL} from './constants';
import {addError, ExtensionError, removeError} from '../errors';
import fs from 'fs';
import {getGenreIds} from '../../redux/selectors';
import shortid from 'shortid';
import {RootState} from '../../redux/store';
import {findAsync, getDoc, getGenresByRow} from './utils';
import {downloadImage} from '../utils';

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
  return fetch(link).then((res: Response) => res.text()).then((htmlString: string) => {
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
  return fetch(artist.wikiPage).then((res: Response) => res.text()).then((htmlString: string) => {
    removeError(artist, ExtensionError.PARSER);
    const doc = getDoc(htmlString);
    const infoBoxes = doc.getElementsByClassName('infobox');
    const infoBox = infoBoxes[0];
    const rows = infoBox.getElementsByTagName('tr');
    const genres = getGenresByRow(rows);
    if (genres && genres.length) {
      artist.genreIds = getGenreIds(store, genres);
      removeError(artist, ExtensionError.GENRE);
    } else {
      addError(artist, ExtensionError.GENRE);
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
    let filePath = artist.artFile || `${DATA_DIR}/${shortid.generate()}.png`;
    return downloadImage(picURL, filePath).then(() => {
      removeError(artist, ExtensionError.PIC);
      artist.artFile = filePath;
    }).catch(() => {
      addError(artist, ExtensionError.PIC);
      return Promise.resolve();
    });
  }).catch(() => {
    addError(artist, ExtensionError.PARSER);
    return Promise.resolve();
  });
}

export default function runArtistModifier(store: RootState, artist: Artist): Promise<ArtistInfo> {
  if (!artist.wikiPage) {
    return searchForWikiPage(artist).then((wikiPage) => {
      if (wikiPage) {
        artist.wikiPage = wikiPage;
        removeError(artist, ExtensionError.NO_MATCH);
        return modifyArtist(store, artist).then(() => {
          return {...artist};
        });
      }
      // Only an error state if the MusicBrainz extension has no match either.
      if (artist.mbid) {
        removeError(artist, ExtensionError.NO_MATCH);
      } else {
        addError(artist, ExtensionError.NO_MATCH);
      }
      return Promise.resolve({errors: [...artist.errors]});
    });
  }
  removeError(artist, ExtensionError.NO_MATCH);
  return modifyArtist(store, artist).then(() => {
    return {...artist};
  });
}
