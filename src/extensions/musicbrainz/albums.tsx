import {Album, AlbumInfo, Track} from '../../redux/actionTypes';
import {DATA_DIR} from '../../constants';
import {addError, ExtensionError, removeError} from '../errors';
import fs from 'fs';
import {getArtistsByIds, getGenreIds, getTracksByIds} from '../../redux/selectors';
import shortid from 'shortid';
import {RootState} from '../../redux/store';
import {
  browseReleases,
  COVER_ART_BASE,
  fetchWithRetry,
  getFeaturedArtists,
  getGenreNames,
  getReleaseTracks,
  lookupReleaseGroup,
  matchTracklist,
  pickBestReleaseGroup,
  ReleaseTrack,
  searchReleaseGroups,
} from './api';

function searchForReleaseGroup(store: RootState, album: Album): Promise<string | undefined> {
  const artistNames = getArtistsByIds(store, album.artistIds).map((artist) => artist.name);
  return searchReleaseGroups(album.name, artistNames[0]).then((results) => {
    const match = pickBestReleaseGroup(results, album.name, artistNames);
    return match && match.id;
  });
}

function downloadCoverArt(album: Album): Promise<void> {
  const url = `${COVER_ART_BASE}/release-group/${album.mbid}/front-500`;
  return fetchWithRetry(url).then((res) => {
    if (!res.ok) {
      return Promise.reject(new Error(`No cover art: ${res.status}`));
    }
    return res.arrayBuffer();
  }).then((data) => {
    const filePath = album.albumArtFile || `${DATA_DIR}/${shortid.generate()}.png`;
    fs.writeFileSync(filePath, Buffer.from(data));
    album.albumArtFile = filePath;
  });
}

function setTrackWarnings(track: Track, releaseTrack: ReleaseTrack): void {
  const warning = track.warning || {};
  if (track.name !== releaseTrack.title) {
    warning.name = releaseTrack.title;
  }
  const featuring = getFeaturedArtists(releaseTrack);
  if (featuring.length > 0) {
    warning.featuring = featuring;
  }
  if (Object.keys(warning).length > 0) {
    track.warning = warning;
  }
}

function verifyTracks(store: RootState, album: Album): Promise<void> {
  return browseReleases(album.mbid as string).then((releases) => {
    const refTracks = getTracksByIds(store, album.trackIds);
    const match = matchTracklist(releases, refTracks.length);
    if (!match.release) {
      // Missing tracks from the original edition, or no edition lines up.
      addError(album, ExtensionError.TRACK);
      return;
    }
    const releaseTracks = getReleaseTracks(match.release);
    refTracks.forEach((track, index) => {
      setTrackWarnings(track, releaseTracks[index]);
    });
    removeError(album, ExtensionError.TRACK);
  }).catch(() => {
    addError(album, ExtensionError.TRACK);
  });
}

function modifyAlbum(store: RootState, album: Album): Promise<void> {
  return lookupReleaseGroup(album.mbid as string).then((lookup) => {
    removeError(album, ExtensionError.LOOKUP);
    const year = parseInt((lookup['first-release-date'] || '').slice(0, 4), 10);
    if (year) {
      album.year = year;
      removeError(album, ExtensionError.YEAR);
    } else {
      addError(album, ExtensionError.YEAR);
    }
    const genres = getGenreNames(lookup.genres);
    if (genres.length) {
      album.genreIds = getGenreIds(store, genres);
      removeError(album, ExtensionError.GENRE);
    } else {
      addError(album, ExtensionError.GENRE);
    }
    return verifyTracks(store, album).then(() => {
      return downloadCoverArt(album).then(() => {
        removeError(album, ExtensionError.ALBUM_ART);
      }).catch(() => {
        addError(album, ExtensionError.ALBUM_ART);
      });
    });
  }).catch(() => {
    addError(album, ExtensionError.LOOKUP);
  });
}

function recordNoMatch(album: Album): void {
  // Only an error state if the wiki extension has no match for this album either.
  if (album.wikiPage) {
    removeError(album, ExtensionError.NO_MATCH);
  } else {
    addError(album, ExtensionError.NO_MATCH);
  }
}

export default function runAlbumModifier(store: RootState, album: Album): Promise<AlbumInfo> {
  if (!album.mbid) {
    return searchForReleaseGroup(store, album).then((mbid) => {
      if (mbid) {
        album.mbid = mbid;
        removeError(album, ExtensionError.NO_MATCH);
        return modifyAlbum(store, album).then(() => {
          return {...album};
        });
      }
      recordNoMatch(album);
      return Promise.resolve({errors: [...album.errors]});
    }).catch(() => {
      recordNoMatch(album);
      return Promise.resolve({errors: [...album.errors]});
    });
  }
  removeError(album, ExtensionError.NO_MATCH);
  return modifyAlbum(store, album).then(() => {
    return {...album};
  });
}
