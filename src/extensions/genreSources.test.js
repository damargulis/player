import {applyGenres} from './genreSources';
import {MetaSource} from './errors';
import store from '../redux/store';
import {UPDATE_LIBRARY} from '../redux/actionTypes';

/**
 * The part of the union rule that touches the entity: an album ends up holding what the sources
 * say between them, which is also how a genre that came in from the iTunes import goes away.
 */

function state() {
  store.dispatch({
    payload: {library: {albums: {}, artists: {}, genres: {}, tracks: {}}},
    type: UPDATE_LIBRARY,
  });
  return store.getState();
}

function namesOf(root, ids) {
  return ids.map((id) => root.library.genres[id].name);
}

test('replaces an imported genre with what the sources say', () => {
  const root = state();
  const imported = ['itunes-genre'];
  root.library.genres['itunes-genre'] = {name: 'Alternative'};
  const album = {errors: [], genreIds: imported};
  applyGenres(root, album, MetaSource.MUSICBRAINZ, ['Shoegaze', 'Dream Pop']);
  expect(namesOf(root, album.genreIds)).toEqual(['Shoegaze', 'Dream Pop']);
});

test('the second source adds to the first instead of replacing it', () => {
  const root = state();
  const album = {errors: [], genreIds: []};
  applyGenres(root, album, MetaSource.MUSICBRAINZ, ['Shoegaze']);
  applyGenres(root, album, MetaSource.WIKIPEDIA, ['Dream Pop']);
  expect(namesOf(root, album.genreIds)).toEqual(['Shoegaze', 'Dream Pop']);
  expect(album.errors).toEqual([]);
});

test('a source with nothing to say leaves the genres alone', () => {
  const root = state();
  const album = {errors: [], genreIds: []};
  applyGenres(root, album, MetaSource.MUSICBRAINZ, ['Shoegaze']);
  applyGenres(root, album, MetaSource.WIKIPEDIA, []);
  expect(namesOf(root, album.genreIds)).toEqual(['Shoegaze']);
});

/**
 * Non-destructive when no source has anything: a coarse imported genre beats none, the error
 * already says no source could confirm it, and a Run All whose Wikipedia step throws (103
 * albums here will not parse) must not leave the album genreless.
 */
test('keeps the imported genre when no source has any', () => {
  const root = state();
  root.library.genres['itunes-genre'] = {name: 'Alternative'};
  const album = {errors: [], genreIds: ['itunes-genre']};
  applyGenres(root, album, MetaSource.MUSICBRAINZ, []);
  expect(namesOf(root, album.genreIds)).toEqual(['Alternative']);
  expect(album.errors).toEqual(['No genres found.']);
});

test('reuses an existing genre id rather than interning a second one', () => {
  const root = state();
  const first = {errors: [], genreIds: []};
  const second = {errors: [], genreIds: []};
  applyGenres(root, first, MetaSource.MUSICBRAINZ, ['Shoegaze']);
  applyGenres(root, second, MetaSource.WIKIPEDIA, ['Shoegaze']);
  expect(second.genreIds).toEqual(first.genreIds);
});
