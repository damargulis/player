import {loadLibrary} from './main';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * `loadLibrary` rebuilds every entity field by field rather than using the parsed JSON, so a
 * field added to `Track`, `Album` or `Artist` and not added there is **silently discarded** —
 * the track loads, the app runs, and the next save writes the library back without it.
 *
 * That is not hypothetical. `lyrics` was missing from the track list, so every restart erased
 * the lyrics markers for the whole library while leaving the .lrc files on disk, and the only
 * symptom was the `L` quietly vanishing from the track list.
 *
 * These fixtures are deliberately *fully populated* — every optional field set to something
 * recognisable — so a dropped field shows up as a concrete diff rather than passing because
 * the test data never exercised it.
 */
const track = {
  albumIds: ['album-1'],
  artistIds: ['artist-1'],
  dateAdded: new Date('2020-02-02T00:00:00.000Z'),
  duration: 215000,
  favorites: [2021, 2024],
  filePath: '/music/song.mp3',
  genius: {errors: [], id: '999', missedBy: undefined, page: 'https://genius.com/song'},
  genreIds: ['genre-1'],
  id: 'track-1',
  lyrics: {errors: [], fetchedAt: 1700000000000, instrumental: false, synced: true},
  name: 'Song',
  playCount: 12,
  playDate: new Date('2024-01-01T00:00:00.000Z'),
  reactions: {chloe: {2024: 'like'}},
  skipCount: 1,
  warning: {name: 'Different name on wikipedia'},
  year: 1999,
};

const album = {
  albumArtFile: '/data/art.png',
  artistIds: ['artist-1'],
  coverArt: {maxPx: 1200, target: 1200},
  errors: [],
  genreIds: ['genre-1'],
  id: 'album-1',
  mbid: 'mb-album',
  name: 'Album',
  playCount: 20,
  trackIds: ['track-1'],
  wikiPage: 'https://en.wikipedia.org/wiki/Album',
  year: 1999,
};

const artist = {
  albumIds: ['album-1'],
  artFile: '/data/artist.png',
  errors: [],
  genreIds: ['genre-1'],
  id: 'artist-1',
  mbid: 'mb-artist',
  name: 'Artist',
  trackIds: ['track-1'],
  wikiPage: 'https://en.wikipedia.org/wiki/Artist',
};

function writeFixture() {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mymusic-lib-')), 'library.json');
  fs.writeFileSync(file, JSON.stringify({
    albums: {'album-1': album},
    artists: {'artist-1': artist},
    genres: {'genre-1': {name: 'Rock'}},
    newTracks: [],
    playlists: [],
    tracks: {'track-1': track},
  }));
  return file;
}

/** Dates are rehydrated by hand on load, so compare them as epoch numbers. */
function comparable(entity) {
  const copy = {};
  Object.keys(entity).forEach((key) => {
    const value = entity[key];
    copy[key] = value instanceof Date ? value.getTime() : value;
  });
  return copy;
}

describe('loadLibrary keeps every field it was given', () => {
  let loaded;

  beforeAll(() => loadLibrary(writeFixture()).then((state) => loaded = state));

  it('keeps every track field, lyrics markers included', () => {
    const got = loaded.tracks['track-1'];
    // the assertion that matters: no key of the written track may be missing from the loaded one
    expect(Object.keys(track).filter((key) => !(key in got))).toEqual([]);
    expect(comparable(got)).toEqual(comparable(track));
  });

  it('keeps every album field', () => {
    const got = loaded.albums['album-1'];
    expect(Object.keys(album).filter((key) => !(key in got))).toEqual([]);
    expect(comparable(got)).toEqual(comparable(album));
  });

  it('keeps every artist field', () => {
    const got = loaded.artists['artist-1'];
    expect(Object.keys(artist).filter((key) => !(key in got))).toEqual([]);
    expect(comparable(got)).toEqual(comparable(artist));
  });
});

/**
 * Wikipedia's TemplateStyles leaked CSS into the genre list — `.mw-parser-output .hlist dl`
 * and 38 more like it were stored as genres. The parser no longer reads them, but the stored
 * ones have to go, and they go on load so the file repairs itself.
 */
describe('loadLibrary drops junk genres', () => {
  function libraryWith(genres, trackGenreIds) {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mymusic-genres-')), 'library.json');
    fs.writeFileSync(file, JSON.stringify({
      albums: {},
      artists: {},
      genres,
      newTracks: [],
      playlists: [],
      tracks: {'track-1': Object.assign({}, track, {genreIds: trackGenreIds || []})},
    }));
    return file;
  }

  it('removes css fragments nothing points at', async () => {
    const state = await loadLibrary(libraryWith({
      'g-1': {name: 'Shoegaze'},
      'g-2': {name: '.mw-parser-output .hlist dl'},
      'g-3': {name: '.mw-parser-output .hlist ul{margin:0;padding:0}'},
    }));
    expect(Object.keys(state.genres)).toEqual(['g-1']);
  });

  /** A dangling reference is worse than a visible wrong genre. */
  it('keeps a junk genre that something still references', async () => {
    const state = await loadLibrary(libraryWith({
      'g-1': {name: 'Shoegaze'},
      'g-2': {name: '.mw-parser-output .hlist dl'},
    }, ['g-1', 'g-2']));
    expect(Object.keys(state.genres).sort()).toEqual(['g-1', 'g-2']);
  });

  it('keeps real genres with punctuation in them', async () => {
    const state = await loadLibrary(libraryWith({
      'g-1': {name: 'Rock & Roll'},
      'g-2': {name: 'Hip-Hop'},
      'g-3': {name: 'Drum And Bass'},
    }));
    expect(Object.keys(state.genres).sort()).toEqual(['g-1', 'g-2', 'g-3']);
  });

  /** There is no length limit: it rejected none of the real junk and could discard a real name. */
  it('keeps a long but genuine genre name', async () => {
    const state = await loadLibrary(libraryWith({
      'g-1': {name: 'Progressive Experimental Post-Hardcore Revival'},
    }));
    expect(Object.keys(state.genres)).toEqual(['g-1']);
  });
});
