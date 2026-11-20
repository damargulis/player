import {Album, AlbumInfo, Track} from '../../redux/actionTypes';
import {
  browseRecordings,
  browseReleases,
  COVER_ART_BASE,
  fetchWithRetry,
  getFeaturedArtists,
  getGenreNames,
  getReleaseTracks,
  getWikiPageUrl,
  lookupReleaseGroup,
  matchTracklist,
  pickBestReleaseGroup,
  recordingUpdate,
  ReleaseGroupLookup,
  ReleaseTrack,
  searchReleaseGroups,
  unexplainedTypes,
} from './api';
import {writeIfBigger} from '../artFile';
import {DATA_DIR} from '../../constants';
import {addError, ExtensionError, MetaSource, recordYear, removeError, setError} from '../errors';
import fs from 'fs';
import {applyGenres} from '../genreSources';
import {pairTracks} from '../pairTracks';
import {getArtistsByIds, getGenreIds, getTracksByIds} from '../../redux/selectors';
import shortid from 'shortid';
import {RootState} from '../../redux/store';
import {applyRecording} from './tracks';

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
    // front-500 must not replace the larger art the Cover Art extension fetches at
    // front-1200; whichever extension runs last should not decide the resolution.
    const result = writeIfBigger(album.albumArtFile, Buffer.from(data));
    if (result.path) {
      album.albumArtFile = result.path;
    }
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
    // by title, not position: a multi-disc album's local order is not the release's
    const paired = pairTracks(refTracks, getReleaseTracks(match.release), (entry) => entry.title);
    refTracks.forEach((track, index) => {
      const entry = paired[index] as ReleaseTrack;
      setTrackWarnings(track, entry);
      // the one moment this track is known to be a particular recording; keep it, so the track
      // extension can look the song up directly without matching the whole album again
      if (entry && entry.recording) {
        track.mbid = entry.recording.id;
      }
    });
    removeError(album, ExtensionError.TRACK);
    // The tracklist has just been matched one-to-one, so this is the moment each local track is
    // known to be a particular recording. One more request gets every recording's genres and
    // first release date; a failure here costs only that, never the album's other results.
    return browseRecordings(match.release.id).then((recordings) => {
      refTracks.forEach((track, index) => {
        const entry = paired[index];
        const recording = entry && entry.recording && recordings[entry.recording.id];
        if (recording) {
          applyRecording(store, track, recording);
        }
      });
    }, () => undefined);
  }).catch(() => {
    addError(album, ExtensionError.TRACK);
  });
}

function modifyAlbum(store: RootState, album: Album, rematched: boolean = false): Promise<void> {
  return lookupReleaseGroup(album.mbid as string).then((lookup) => {
    removeError(album, ExtensionError.LOOKUP);
    // An album matched before the picker learnt to prefer originals may still be pointing at a
    // live album or a compilation that shares its title — "Hotel California" was on a 1992 live
    // record. The lookup already says what kind of release this is, so check it here and, once,
    // look again. A better match moves the album; finding none leaves it where it was.
    if (!rematched && unexplainedTypes(lookup['secondary-types'], album.name).length) {
      return searchForReleaseGroup(store, album).then((better) => {
        if (better && better !== album.mbid) {
          album.mbid = better;
          return modifyAlbum(store, album, true);
        }
        return carryOn(store, album, lookup);
      }, () => carryOn(store, album, lookup));
    }
    return carryOn(store, album, lookup);
  }).catch(() => {
    addError(album, ExtensionError.LOOKUP);
  });
}

/** Everything a release-group lookup feeds: year, genres, the Wikipedia page, tracks and art. */
function carryOn(store: RootState, album: Album, lookup: ReleaseGroupLookup): Promise<void> {
  {
    // As for artists: MusicBrainz knows the Wikipedia page, so the wiki extension does not
    // have to guess ten urls from the album title. Fewer albums are reachable than artists —
    // a sampled 35% of the 152 with an mbid and no page — but it costs no extra request.
    const wikiPage = album.wikiPage
      ? Promise.resolve(album.wikiPage)
      : getWikiPageUrl(lookup.relations);
    const year = parseInt((lookup['first-release-date'] || '').slice(0, 4), 10);
    if (year) {
      album.year = year;
    }
    // Recorded against this source rather than assigned outright: the wiki extension runs
    // after this one, and a page with no genre row used to erase what MusicBrainz found.
    recordYear(album, MetaSource.MUSICBRAINZ, Boolean(year));
    applyGenres(store, album, MetaSource.MUSICBRAINZ, getGenreNames(lookup.genres));
    return wikiPage.then((page: string | undefined) => {
      if (page) {
        album.wikiPage = page;
      }
      return verifyTracks(store, album);
    }).then(() => {
      // the error states whether the album has art, not whether this fetch worked: a failed
      // request against an album that already has a cover is not a missing cover
      return downloadCoverArt(album)
        .catch(() => undefined)
        .then(() => setError(album, ExtensionError.ALBUM_ART, !album.albumArtFile));
    });
  }
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
