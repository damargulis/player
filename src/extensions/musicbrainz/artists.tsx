import {Artist, ArtistInfo} from '../../redux/actionTypes';
import {
  ArtistLookup,
  fetchWithRetry,
  getArtistImageUrl,
  getGenreNames,
  lookupArtist,
  pickBestArtist,
  searchArtists,
} from './api';
import {DATA_DIR} from '../../constants';
import {addError, ExtensionError, removeError} from '../errors';
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
      const filePath = artist.artFile || `${DATA_DIR}/${shortid.generate()}.png`;
      fs.writeFileSync(filePath, Buffer.from(data));
      artist.artFile = filePath;
    });
  });
}

function modifyArtist(store: RootState, artist: Artist): Promise<void> {
  return lookupArtist(artist.mbid as string).then((lookup) => {
    removeError(artist, ExtensionError.LOOKUP);
    const genres = getGenreNames(lookup.genres);
    if (genres.length) {
      artist.genreIds = getGenreIds(store, genres);
      removeError(artist, ExtensionError.GENRE);
    } else {
      addError(artist, ExtensionError.GENRE);
    }
    return downloadArtistImage(artist, lookup).then(() => {
      removeError(artist, ExtensionError.PIC);
    }).catch(() => {
      addError(artist, ExtensionError.PIC);
    });
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
