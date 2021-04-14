import * as React from 'react';
import {Album, AlbumInfo, Artist} from '../../redux/actionTypes';
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
  while (nextNode && nextNode.tagName != targetHeader.tagName) {
    contentNodes.push(nextNode);
    nextNode = nextNode.nextElementSibling;
  }
  return contentNodes;
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
    title = getInsideOfQuotes(title.trim());
    if (title) {
      tracks.push({name: title});
    }
  }
  return tracks
}

function getTracksFromTable(table: HTMLTableElement): TrackInfo[] {
  const header = table.rows[0];
  const infos = [] as TrackInfo[];
  const headerCells = [...header.cells];
  const titleCell = headerCells.find((cell) => cell.textContent == 'Title');
  const titleIndex = headerCells.indexOf(titleCell as HTMLTableHeaderCellElement);
  for (const row of table.rows) {
    if (row == header) {
      continue;
    }
    let title = getInsideOfQuotes(row.cells[titleIndex].textContent || '');
    if (title) {
      infos.push({
        name: title
      });
    }
  }
  return infos;
}

interface PlaylistInfo {
  classification: TracklistType;
  tracks: TrackInfo[];
}

export function getTracks(doc: Document): PlaylistInfo[] {
  debugger;
  const tracklistSection = getAllNodesInSection(doc, "Track listing");
  const tables = tracklistSection.filter((ele) => ele instanceof HTMLTableElement) as HTMLTableElement[];
  if (tables.length > 0) {
    return tables.map((table) => {
      return {
        classification: classifyTable(table),
        tracks: getTracksFromTable(table),
      }
    });
  }
  const headers = [] as Element[];
  const lists = [] as HTMLOListElement[];
  tracklistSection.forEach((section, index) => {
    if (section instanceof HTMLOListElement) {
      lists.push(section);
      if (index > 0) {
        headers.push(tracklistSection[index-1]);
      }
    }
  });
  if (lists.length == 1 && headers.length == 0) {
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
    }
  });
}

function addTrackWarning(album: Album, index: number, trackTitles: string): void {
  album.warnings[index] = trackTitles;
}

function modifyAlbum(store: RootState, album: Album): Promise<void> {
  if (!album.wikiPage) {
    return Promise.resolve();
  }
  return rp(album.wikiPage).then((htmlString: string) => {
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
    const regularPlaylists = playlists.filter((playlists) => playlists.classification == TracklistType.SIDE);
    const regularTracks = regularPlaylists.map((playlist) => playlist.tracks).flat();
    const bonusPlaylists = playlists.filter((playlists) => playlists.classification == TracklistType.BONUS);
    const bonusTracks = bonusPlaylists.map((playlist) => playlist.tracks).flat();
    const refTracks = getTracksByIds(store, album.trackIds);
    removeError(album, TRACK_ERROR);
    if (refTracks.length < regularTracks.length) {
      addError(album, TRACK_ERROR);
    } else if (refTracks.length == regularTracks.length) {
      refTracks.forEach((track, index) => {
        if (track.name !== regularTracks[index].name) {
          addTrackWarning(album, index, regularTracks[index].name);
        }
      });
      // TODO: make this a warning?
      //if (bonusTracks.length > 0) {
      //  addError(album, TRACK_ERROR);
      //}
    } else if (refTracks.length < regularTracks.length + bonusTracks.length) {
      addError(album, TRACK_ERROR);
      // see if it matches just some bonus versions?
    } else if (refTracks.length == regularTracks.length + bonusTracks.length) {
      const totalTracks = [...regularTracks, ...bonusTracks];
      refTracks.forEach((track, index) => {
        if (track.name !== totalTracks[index].name) {
          addTrackWarning(album, index, totalTracks[index].name);
        }
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
      removeError(album, ALBUM_ART_ERROR);
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
