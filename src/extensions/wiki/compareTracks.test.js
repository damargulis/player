const {compareTracks} = require('./albums');
const {ExtensionError} = require('../errors');
const store = require('../../redux/store').default;
const {UPDATE_LIBRARY} = require('../../redux/actionTypes');

/**
 * Which error a tracklist produces, which is the part that made the old one unreadable: an
 * unreadable page fell through to "wrong number of tracks", so that error was being reported
 * for every one of the 1,968 albums here with a Wikipedia page.
 */

function track(id) {
  return {albumIds: [], artistIds: [], favorites: [], genreIds: [], id, name: id, playCount: 0,
    skipCount: 0, year: 2000};
}

function setUp(trackCount) {
  const tracks = {};
  const ids = [];
  for (let index = 0; index < trackCount; index++) {
    ids.push(`t${index}`);
    tracks[`t${index}`] = track(`t${index}`);
  }
  store.dispatch({payload: {library: {albums: {}, artists: {}, tracks}}, type: UPDATE_LIBRARY});
  return ids;
}

function info(name) {
  return {featuring: [], name};
}

function listing(main, alternate, readable) {
  return {
    alternate: alternate.map(info),
    main: main.map(info),
    readable: readable === undefined ? true : readable,
  };
}

test('an unreadable page is its own error and leaves the count alone', () => {
  const album = {errors: [ExtensionError.TRACK], id: 'a', trackIds: setUp(3)};
  compareTracks(store.getState(), album, listing([], [], false));
  expect(album.errors).toContain(ExtensionError.TRACKLIST);
  // MusicBrainz may have a real verdict on the count; nothing here knows better
  expect(album.errors).toContain(ExtensionError.TRACK);
});

test('a readable page clears the unreadable error', () => {
  const album = {errors: [ExtensionError.TRACKLIST], id: 'a', trackIds: setUp(2)};
  compareTracks(store.getState(), album, listing(['one', 'two'], []));
  expect(album.errors).toStrictEqual([]);
});

test('matching the main release is complete', () => {
  const album = {errors: [], id: 'a', trackIds: setUp(2)};
  compareTracks(store.getState(), album, listing(['one', 'two'], []));
  expect(album.errors).toStrictEqual([]);
});

/** The old rule flagged this, with a TODO asking whether it should be a warning instead. */
test('bonus tracks listed on the page are not missing tracks', () => {
  const album = {errors: [], id: 'a', trackIds: setUp(2)};
  compareTracks(store.getState(), album, listing(['one', 'two'], ['japanese bonus']));
  expect(album.errors).toStrictEqual([]);
});

test('owning every edition is complete too', () => {
  const album = {errors: [], id: 'a', trackIds: setUp(3)};
  compareTracks(store.getState(), album, listing(['one', 'two'], ['bonus']));
  expect(album.errors).toStrictEqual([]);
});

test('short of the main release is flagged', () => {
  const album = {errors: [], id: 'a', trackIds: setUp(2)};
  compareTracks(store.getState(), album, listing(['one', 'two', 'three'], []));
  expect(album.errors).toStrictEqual([ExtensionError.TRACK]);
});

test('part of an edition is flagged', () => {
  const album = {errors: [], id: 'a', trackIds: setUp(3)};
  compareTracks(store.getState(), album, listing(['one', 'two'], ['bonus', 'another']));
  expect(album.errors).toStrictEqual([ExtensionError.TRACK]);
});

test('records the page title on a track whose name differs', () => {
  const ids = setUp(1);
  const album = {errors: [], id: 'a', trackIds: ids};
  compareTracks(store.getState(), album, listing(['Different Name'], []));
  expect(store.getState().library.tracks[ids[0]].warning.name).toBe('Different Name');
});
