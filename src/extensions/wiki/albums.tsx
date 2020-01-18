import Album from '../../library/Album';
import Artist from '../../library/Artist';
import {DATA_DIR} from '../../constants';
import {BASE_URL} from './constants';
import {
  ALBUM_ART_ERROR,
  GENRE_ERROR,
  NO_PAGE_ERROR,
  PARSER_ERROR,
  TRACK_ERROR,
  YEAR_ERROR,
} from './errors';
import fs from 'fs';
import moment from 'moment';
import rp from 'request-promise-native';
import {getArtistById, getGenreIds, getTracksByIds} from '../../redux/selectors';
import shortid from 'shortid';
import {RootState} from '../../redux/store';
import {findAsync, getDoc, getGenresByRow, sanitize} from './utils';

function getYear(rootNode: HTMLElement): number {
  const released = rootNode.textContent || '';
  let str = sanitize(released);
  if (str.indexOf('(') > 0) {
    str = str.slice(0, str.indexOf('('));
  }
  const time = moment(str);
  return time.year();
}

function getYearByRow(rows: HTMLCollectionOf<HTMLTableRowElement>): number | undefined {
  for (const row of rows) {
    const headers = row.getElementsByTagName('th');
    const name = headers[0] && headers[0].textContent;
    if (name === 'Released') {
      const data = row.getElementsByTagName('td')[0];
      return getYear(data);
    }
  }
  return;
}

function getAllWikiOptions(store: RootState, album: Album): string[] {
  const artist = getArtistById(store, album.artistIds[0]);
  const albumName = album.name.replace('#', 'Number ').replace(/ /g, '_');
  const artistName = artist.name.replace(/ /g, '_');
  return [
    `${BASE_URL}${albumName}`,
    `${BASE_URL}${albumName}_(album)`,
    `${BASE_URL}${albumName}_(${artistName}_album)`,
    `${BASE_URL}${albumName}_(EP)`,
    `${BASE_URL}${albumName}_(mixtape)`,
    `${BASE_URL}${albumName}_(song)`,
    `${BASE_URL}${albumName}_(${artistName}_song)`,
    `${BASE_URL}${albumName}_(${artistName}_mixtape)`,
    `${BASE_URL}${albumName}_(${artistName}_EP)`,
    `${BASE_URL}${albumName}_(${album.year}_album)`,
  ];
}

function isRightLink(link: string, album: Album, artist: Artist): Promise<boolean> {
  return rp(link).then((htmlString: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const infoBoxes = doc.getElementsByClassName('infobox');
    const infoBox = infoBoxes[0] as HTMLElement;
    if (!infoBox || !infoBox.textContent) {
      return false;
    }
    return infoBox.textContent.toLowerCase().includes(
      'by ' + artist.name.toLowerCase());
  }).catch(() => {
    return false;
  });
}

function searchForWikiPage(store: RootState, album: Album): Promise<string> {
  const options = getAllWikiOptions(store, album);
  const artist = getArtistById(store, album.artistIds[0]);
  return findAsync(options, (option: string) => {
    return isRightLink(option, album, artist);
  });
}

function getTracksFromTracklist(tracklist: Element): string[] {
  const rows = tracklist.getElementsByTagName('tr');
  // splits into two arrays, headers which contains any rows that have a <th>
  // element, and dataRows which has all the others
  const headers = [];
  const dataRows = [];
  for (const row of rows) {
    if (row.getElementsByTagName('th').length) {
      headers.push(row);
    } else {
      dataRows.push(row);
    }
  }
  let goodHeader;
  for (const header of headers) {
    if (header.textContent && header.textContent.includes('Title')) {
      goodHeader = header;
      break;
    }
  }
  const headerCells = goodHeader ? goodHeader.getElementsByTagName('th') : [];
  const headerNames = Array(...headerCells).map((cell) => cell.textContent);
  // const noIndex = headerNames.indexOf('No.');
  const titleIndex = headerNames.indexOf('Title');
  // const lengthIndex = headerNames.indexOf('Length');
  return dataRows.map((row) => {
    const data = row.getElementsByTagName('td');
    const titleText = data[titleIndex].textContent || '';
    const matches = titleText.match(/"(?<inner>.*?)"/);
    return matches && matches.groups ? matches.groups.inner : undefined;
  }).filter(Boolean) as string[];
}

function getTracks(doc: Document): string[] {
  const tracklists = doc.getElementsByClassName('tracklist');
  // TODO: using first for now, should loop through all, check header to
  // determine what to do with it; can include multi releases, discs, versions,
  // etc.
  if (tracklists.length === 0) {
    return [];
  }
  let tracks = [] as string[];
  for (const tracklist of tracklists) {
    // tracklists that are hidden are usually bonus tracks .. maybe include
    // but give different warning for missing bonus tracks?
    if (!tracklist.className.includes('collapsible')) {
      tracks = [...tracks, ...getTracksFromTracklist(tracklist)];
    }
  }
  return tracks;
}

function modifyAlbum(store: RootState, album: Album): Promise<void> {
  if (!album.wikiPage) {
    return Promise.resolve();
  }
  return rp(album.wikiPage).then((htmlString: string) => {
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
      album.genreIds = getGenreIds(store, genres);
      album.removeError(GENRE_ERROR);
    } else {
      album.addError(GENRE_ERROR);
    }
    const trackTitles = getTracks(doc);
    if (album.trackIds.length === trackTitles.length) {
      const tracks = getTracksByIds(store, album.trackIds);
      tracks.forEach((track, index) => {
        if (track.name !== trackTitles[index]) {
          album.addTrackWarning(index, trackTitles[index]);
        }
      });
      album.removeError(TRACK_ERROR);
    } else {
      album.addError(TRACK_ERROR);
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
      if (!album.albumArtFile) {
        const id = shortid.generate();
        album.albumArtFile = `${DATA_DIR}/${id}.png`;
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

export default function runAlbumModifier(store: RootState, album: Album): Promise<void> {
  if (!album.wikiPage) {
    return searchForWikiPage(store, album).then((wikiPage) => {
      if (wikiPage) {
        album.removeError(NO_PAGE_ERROR);
        album.wikiPage = wikiPage;
        return modifyAlbum(store, album);
      }
      // add error for no wiki page
      album.addError(NO_PAGE_ERROR);
      return Promise.resolve();
    });
  }
  return modifyAlbum(store, album);
}
