import {Artist, ArtistInfo} from '../../redux/actionTypes';
import {
  ArtistLookup,
  fetchWithRetry,
  getArtistImageUrl,
  getGenreNames,
  getWikiPageUrl,
  lookupArtist,
  pickBestArtist,
  searchArtists,
} from './api';
import {writeIfBigger} from '../artFile';
import {DATA_DIR} from '../../constants';
import {addError, ExtensionError, MetaSource, recordSource, removeError, setError} from '../errors';
import fs from 'fs';
import {getGenreIds} from '../../redux/selectors';
import shortid from 'shortid';
import {RootState} from '../../redux/store';

function downloadArtistImage(artist: Artist, lookup: ArtistLookup): Promise<void> {
  return getArtistImageUrl(lookup).then((url) => {
    if (!url) {
      return Promise.reject(new Error('No image found'));
    }
    return fetchWithRetry(url).then((res) => {
      if (!res.ok) {
        return Promise.reject(new Error(`No image: ${res.status}`));
      }
      return res.arrayBuffer();
    }).then((data) => {
      const result = writeIfBigger(artist.artFile, Buffer.from(data));
      if (result.path) {
        artist.artFile = result.path;
      }
    });
  });
}

function modifyArtist(store: RootState, artist: Artist): Promise<void> {
  return lookupArtist(artist.mbid as string).then((lookup) => {
    removeError(artist, ExtensionError.LOOKUP);
    // The relations were already being requested and thrown away. MusicBrainz knows the
    // Wikipedia page, so the wiki extension does not have to guess at urls — 296 artists here
    // had an mbid and no wikiPage, of which a sampled 85% are reachable this way.
    const wikiPage = artist.wikiPage
      ? Promise.resolve(artist.wikiPage)
      : getWikiPageUrl(lookup.relations);
    const genres = getGenreNames(lookup.genres);
    if (genres.length) {
      artist.genreIds = getGenreIds(store, genres);
    }
    recordSource(artist, 'genres', MetaSource.MUSICBRAINZ, genres.length > 0);
    return wikiPage.then((page: string | undefined) => {
      if (page) {
        artist.wikiPage = page;
      }
      return downloadArtistImage(artist, lookup).catch(() => undefined);
    }).then(() => setError(artist, ExtensionError.PIC, !artist.artFile));
  }).catch(() => {
    addError(artist, ExtensionError.LOOKUP);
  });
}

function recordNoMatch(artist: Artist): void {
  // Only an error state if the wiki extension has no match for this artist either.
  if (artist.wikiPage) {
    removeError(artist, ExtensionError.NO_MATCH);
  } else {
    addError(artist, ExtensionError.NO_MATCH);
  }
}

export default function runArtistModifier(store: RootState, artist: Artist): Promise<ArtistInfo> {
  if (!artist.mbid) {
    return searchArtists(artist.name).then((results) => {
      const match = pickBestArtist(results, artist.name);
      if (match) {
        artist.mbid = match.id;
        removeError(artist, ExtensionError.NO_MATCH);
        return modifyArtist(store, artist).then(() => {
          return {...artist};
        });
      }
      recordNoMatch(artist);
      return Promise.resolve({errors: [...artist.errors]});
    }).catch(() => {
      recordNoMatch(artist);
      return Promise.resolve({errors: [...artist.errors]});
    });
  }
  removeError(artist, ExtensionError.NO_MATCH);
  return modifyArtist(store, artist).then(() => {
    return {...artist};
  });
}
