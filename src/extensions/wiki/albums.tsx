import {Album, AlbumInfo, Artist, Track} from '../../redux/actionTypes';
import {downloadIfBigger} from '../artFile';
import {BASE_URL} from './constants';
import {addError, ExtensionError, MetaSource, recordYear, removeError, setError} from '../errors';
import {applyGenres} from '../genreSources';
import moment from 'moment';
import {pairTracks} from '../pairTracks';
import * as React from 'react';
import {getArtistById, getTracksByIds} from '../../redux/selectors';
import {RootState} from '../../redux/store';
import {getTracklists, TrackInfo, TracklistResult} from './tracklist';
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

/**
 * Sets the tracklist errors from what the page said.
 *
 * `TRACKLIST` is the new one and the reason this reads clearly at last: an unreadable page used
 * to fall through to `TRACK`, so "wrong number of tracks" was being reported for every album
 * with a Wikipedia page. When the tracklist cannot be read, `TRACK` is left exactly as it is —
 * MusicBrainz may have a real verdict on it, and overwriting that with nothing is the drift
 * that `metaSources` exists to stop elsewhere.
 *
 * Bonus tracks listed on the page are deliberately **not** an error. An album that matches the
 * main release exactly is complete; that it was later reissued with three extra tracks is a
 * fact about the reissue. The old code flagged it anyway, with a `TODO` asking whether it
 * should be a warning — which mattered little while nothing parsed, and would have flagged
 * most of the library the moment this started working.
 */
export function compareTracks(store: RootState, album: Album, parsed: TracklistResult): void {
  setError(album, ExtensionError.TRACKLIST, !parsed.readable);
  if (!parsed.readable) {
    return;
  }
  const refTracks = getTracksByIds(store, album.trackIds);
  const everything = [...parsed.main, ...parsed.alternate];
  // by title, not position: a multi-disc album's local order is not the page's
  const warnAll = (entries: TrackInfo[]) => {
    const paired = pairTracks(refTracks, entries, (entry) => entry.name);
    refTracks.forEach((track, index) => setTrackWarnings(track, paired[index] as TrackInfo));
  };
  if (refTracks.length === parsed.main.length) {
    warnAll(parsed.main);
    removeError(album, ExtensionError.TRACK);
  } else if (refTracks.length === everything.length) {
    // every edition's tracks, which is what owning a deluxe reissue looks like
    warnAll(everything);
    removeError(album, ExtensionError.TRACK);
  } else {
    addError(album, ExtensionError.TRACK);
  }
}

function modifyAlbum(store: RootState, album: Album): Promise<void> {
  if (!album.wikiPage) {
    return Promise.resolve();
  }
  return fetch(album.wikiPage).then((res) => res.text()).then((htmlString: string) => {
    removeError(album, ExtensionError.PARSER);
    const doc = getDoc(htmlString);
    const infoBoxes = doc.getElementsByClassName('infobox');
    const infoBox = infoBoxes[0];
    const rows = infoBox.getElementsByTagName('tr');
    const year = getYearByRow(rows);
    if (year) {
      album.year = year;
    }
    // This page's word alone, so an infobox with no genre row no longer overrides MusicBrainz.
    recordYear(album, MetaSource.WIKIPEDIA, Boolean(year));
    applyGenres(store, album, MetaSource.WIKIPEDIA, getGenresByRow(rows) || []);
    compareTracks(store, album, getTracklists(doc, album.name));

    const pics = infoBox.getElementsByTagName('img');
    // TODO: take multiple pictures (rotate them elsewhere in the app)
    const pic = pics[0];
    let picURL = '';
    if (pic && pic.src) {
      const url = new URL(pic.src);
      url.protocol = 'https://';
      picURL = url.toString();
    }
    // One-way: the infobox image is often a low-resolution fair-use thumbnail, and writing it
    // over art the Cover Art Archive supplied would undo that run. Keeping the existing file
    // still counts as having art, so the error clears either way.
    return downloadIfBigger(picURL, album.albumArtFile).then((result) => {
      if (result.path) {
        album.albumArtFile = result.path;
      }
    }).catch(() => Promise.resolve()).then(() => {
      // the error is a statement about the album, not about this request, so it is set from
      // the outcome either way rather than added on failure and removed on success
      setError(album, ExtensionError.ALBUM_ART, !album.albumArtFile);
    });
  }).catch(() => {
    addError(album, ExtensionError.PARSER);
    return Promise.resolve();
  });
}

export default function runAlbumModifier(store: RootState, album: Album): Promise<AlbumInfo> {
  // TODO: fix this so you don't modify album ...pass in new data object and pass aronud?
  if (!album.wikiPage) {
    return searchForWikiPage(store, album).then((wikiPage) => {
      if (wikiPage) {
        album.wikiPage = wikiPage;
        removeError(album, ExtensionError.NO_MATCH);
        return modifyAlbum(store, album).then(() => {
          return {...album};
        });
      }
      // Only an error state if the MusicBrainz extension has no match either.
      if (album.mbid) {
        removeError(album, ExtensionError.NO_MATCH);
      } else {
        addError(album, ExtensionError.NO_MATCH);
      }
      return Promise.resolve({errors: [...album.errors]});
    });
  }
  removeError(album, ExtensionError.NO_MATCH);
  return modifyAlbum(store, album).then(() => {
    return {...album};
  });
}
