import {Album, AlbumInfo, Artist, Track} from '../../redux/actionTypes';
import {downloadImage} from '../utils';
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
import * as React from 'react';
import {getArtistById, getGenreIds, getTracksByIds} from '../../redux/selectors';
import shortid from 'shortid';
import {RootState} from '../../redux/store';
import {addError, findAsync, getDoc, getGenresByRow, removeError, sanitize} from './utils';


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
  const albumName = album.name.replace('#', 'Number ').replace(/ /g, '_');
  const artist = getArtistById(store, album.artistIds[0]);
  if (artist) {
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
  } else {
    return [
      `${BASE_URL}${albumName}`,
      `${BASE_URL}${albumName}_(EP)`,
      `${BASE_URL}${albumName}_(mixtape)`,
      `${BASE_URL}${albumName}_(song)`,
      `${BASE_URL}${albumName}_(album)`,
      `${BASE_URL}${albumName}_(${album.year}_album)`,
    ];
  }
}

function isRightLink(link: string, album: Album, artist: Artist): Promise<boolean> {
  return fetch(link).then((res: Response) => res.text()).then((htmlString: string) => {
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

function getInsideOfQuotes(text: string): string {
  const matches = text.match(/"(?<inner>.*?)"/);
  return matches && matches.groups ? matches.groups.inner : '';
}

function getAllNodesInSection(doc: Document, headerText: string): Element[] {
  const headerNodes = [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6')];

  const targetHeader = headerNodes.find((node) => node.textContent && node.textContent.includes(headerText));
  if (!targetHeader) {
    return [];
  }
  const targetIndex = headerNodes.indexOf(targetHeader);
  const contentNodes = [];
  let nextNode = targetHeader.nextElementSibling;
  while (nextNode && nextNode.tagName !== targetHeader.tagName) {
    contentNodes.push(nextNode);
    nextNode = nextNode.nextElementSibling;
  }
  return contentNodes;
}

function getFeaturedText(text: string): string {
  const matches = text.match(/\(featuring (?<inner>.*?)\)/);
  return matches && matches.groups ? matches.groups.inner : '';
}

function getFeaturedArtists(text: string): string[] {
  const featuredText = getFeaturedText(text);
  const parts = featuredText.split(/, | and /);
  return parts.filter((part) => part.length > 0);
}

enum TracklistType {
  SIDE,
  BONUS,
}

function classifyHeader(header: Element): TracklistType {
  return classifyText(header.textContent && header.textContent.toLowerCase());
}

function classifyTable(table: HTMLTableElement): TracklistType {
  return classifyText(table.caption && table.caption.textContent);
}

function classifyText(text: string | null): TracklistType {
  if (!text) {
    return TracklistType.SIDE;
  } else if (text.includes('bonus')) {
    return TracklistType.BONUS;
  } else if (text.includes('Bonus')) {
    return TracklistType.BONUS;
  } else if (text.includes('Anniversary')) {
    return TracklistType.BONUS;
  }
  return TracklistType.SIDE;
}

interface TrackInfo {
  name: string;
  featuring: string[];
}

function getTrackInfoFromString(str: string): TrackInfo | undefined {
  const title = getInsideOfQuotes(str);
  if (!title) {
    return undefined;
  }
  return {
    name: title,
    featuring: getFeaturedArtists(str),
  };
}

function getTracksFromList(list: HTMLOListElement): TrackInfo[] {
  const items = list.getElementsByTagName('li');
  const tracks = [];
  for (const item of items) {
    const text = item.textContent || '';
    // 8211 = long hyphen character
    let split = text.split(String.fromCharCode(8211));
    let title = split[0];
    // 45 = short hypen character
    split = title.split(String.fromCharCode(45));
    title = split[0] || '';
    const info = getTrackInfoFromString(title.trim());
    if (info) {
      tracks.push(info);
    }
  }
  return tracks;
}

function getTracksFromTable(table: HTMLTableElement): TrackInfo[] {
  const header = table.rows[0];
  const infos = [] as TrackInfo[];
  const headerCells = [...header.cells];
  const titleCell = headerCells.find((cell) => cell.textContent === 'Title');
  const titleIndex = headerCells.indexOf(titleCell as HTMLTableHeaderCellElement);
  for (const row of table.rows) {
    if (row === header) {
      continue;
    }
    const info = getTrackInfoFromString(row.cells[titleIndex].textContent || '');
    if (info) {
      infos.push(info);
    }
  }
  return infos;
}

interface PlaylistInfo {
  classification: TracklistType;
  tracks: TrackInfo[];
}

export function getTracks(doc: Document): PlaylistInfo[] {
  const tracklistSection = getAllNodesInSection(doc, 'Track listing');
  const tables = tracklistSection.filter((ele) => ele instanceof HTMLTableElement) as HTMLTableElement[];
  if (tables.length > 0) {
    return tables.map((table) => {
      return {
        classification: classifyTable(table),
        tracks: getTracksFromTable(table),
      };
    });
  }
  const headers = [] as Element[];
  const lists = [] as HTMLOListElement[];
  tracklistSection.forEach((section, index) => {
    if (section instanceof HTMLOListElement) {
      lists.push(section);
      if (index > 0) {
        headers.push(tracklistSection[index - 1]);
      }
    }
  });
  if (lists.length === 1 && headers.length === 0) {
    return [{
      classification: TracklistType.SIDE,
      tracks: getTracksFromList(lists[0]),
    }];
  }
  if (headers.length !== lists.length) {
    return [];
  }
  return headers.map((header, index) => {
    return {
      classification: classifyHeader(header),
      tracks: getTracksFromList(lists[index]),
    };
  });
}

function setTrackWarnings(track: Track, trackInfo: TrackInfo): void {
  const warning = track.warning || {};
  if (track.name !== trackInfo.name) {
    warning.name = trackInfo.name;
  }
  if (trackInfo.featuring.length > 0) {
    warning.featuring = trackInfo.featuring;
  }
  if (Object.keys(warning).length > 0) {
    track.warning = warning;
  }
}

function modifyAlbum(store: RootState, album: Album): Promise<void> {
  if (!album.wikiPage) {
    return Promise.resolve();
  }
  return fetch(album.wikiPage).then((res) => res.text()).then((htmlString: string) => {
    removeError(album, PARSER_ERROR);
    const doc = getDoc(htmlString);
    const infoBoxes = doc.getElementsByClassName('infobox');
    const infoBox = infoBoxes[0];
    const rows = infoBox.getElementsByTagName('tr');
    const year = getYearByRow(rows);
    if (year) {
      album.year = year;
      removeError(album, YEAR_ERROR);
    } else {
      addError(album, YEAR_ERROR);
    }
    const genres = getGenresByRow(rows);
    if (genres && genres.length) {
      album.genreIds = getGenreIds(store, genres);
      removeError(album, GENRE_ERROR);
    } else {
      addError(album, GENRE_ERROR);
    }
    const playlists = getTracks(doc);
    const regularPlaylists = playlists.filter((playlist) => playlist.classification === TracklistType.SIDE);
    const regularTracks = regularPlaylists.map((playlist) => playlist.tracks).flat();
    const bonusPlaylists = playlists.filter((playlist) => playlist.classification === TracklistType.BONUS);
    const bonusTracks = bonusPlaylists.map((playlist) => playlist.tracks).flat();
    const refTracks = getTracksByIds(store, album.trackIds);
    removeError(album, TRACK_ERROR);
    if (refTracks.length < regularTracks.length) {
      addError(album, TRACK_ERROR);
    } else if (refTracks.length === regularTracks.length) {
      refTracks.forEach((track, index) => {
        setTrackWarnings(track, regularTracks[index]);
      });
      // TODO: make this a warning?
      if (bonusTracks.length > 0) {
       addError(album, TRACK_ERROR);
      }
    } else if (refTracks.length < regularTracks.length + bonusTracks.length) {
       addError(album, TRACK_ERROR);
       // see if it matches just some bonus versions?
    } else if (refTracks.length === regularTracks.length + bonusTracks.length) {
     const totalTracks = [...regularTracks, ...bonusTracks];
     refTracks.forEach((track, index) => {
       setTrackWarnings(track, totalTracks[index]);
     });
    } else {
     addError(album, TRACK_ERROR);
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
    let filePath = album.albumArtFile || `${DATA_DIR}/${shortid.generate()}.png`;
    return downloadImage(picURL, filePath).then(() => {
      removeError(album, ALBUM_ART_ERROR);
      album.albumArtFile = filePath;
    }).catch(() => {
      addError(album, ALBUM_ART_ERROR);
      return Promise.resolve();
    });
  }).catch(() => {
    addError(album, PARSER_ERROR);
    return Promise.resolve();
  });
}

export default function runAlbumModifier(store: RootState, album: Album): Promise<AlbumInfo> {
  // TODO: fix this so you don't modify album ...pass in new data object and pass aronud?
  removeError(album, NO_PAGE_ERROR);
  if (!album.wikiPage) {
    return searchForWikiPage(store, album).then((wikiPage) => {
      if (wikiPage) {
        album.wikiPage = wikiPage;
        return modifyAlbum(store, album).then(() => {
          return {...album};
        });
      }
      addError(album, NO_PAGE_ERROR);
      return Promise.resolve({errors: [NO_PAGE_ERROR]});
    });
  }
  return modifyAlbum(store, album).then(() => {
    return {...album};
  });
}
