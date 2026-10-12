import {getAutoPlaylists} from './selectors';
import store from './store';
import {UPDATE_LIBRARY} from './actionTypes';

const YEAR = new Date().getFullYear();

function track(id, name, reactions) {
  return {
    albumIds: [], artistIds: [], dateAdded: new Date(0), duration: 1000, favorites: [],
    filePath: `file:///${id}.mp3`, genreIds: [], id, name, playCount: 0,
    playDate: new Date(0), reactions, skipCount: 0, year: 2000,
  };
}

function names() {
  return getAutoPlaylists(store.getState()).map((p) => p.name);
}

beforeEach(() => {
  store.dispatch({
    payload: {library: {albums: {}, artists: {}, tracks: {
      r1: track('r1', 'Liked', {Chloe: {liked: [YEAR], disliked: []}}),
      r2: track('r2', 'Disliked', {Chloe: {liked: [], disliked: [YEAR]}}),
      r3: track('r3', 'Liked by someone else', {Sam: {liked: [YEAR], disliked: []}}),
      r4: track('r4', 'Liked last year', {Chloe: {liked: [YEAR - 1], disliked: []}}),
      r5: track('r5', 'No reaction', undefined),
    }}},
    type: UPDATE_LIBRARY,
  });
});

test('each person gets their own likes and dislikes playlist, per year', () => {
  const playlists = names();
  expect(playlists).toContain(`Chloe's Likes of ${YEAR}`);
  expect(playlists).toContain(`Chloe's Dislikes of ${YEAR}`);
  expect(playlists).toContain(`Chloe's Likes of ${YEAR - 1}`);
  expect(playlists).toContain(`Sam's Likes of ${YEAR}`);
  // nobody disliked anything last year, so that list isn't invented
  expect(playlists).not.toContain(`Chloe's Dislikes of ${YEAR - 1}`);
  expect(playlists).not.toContain(`Sam's Dislikes of ${YEAR}`);
});

test('the playlists hold the right tracks and leave the owner favorites alone', () => {
  const all = getAutoPlaylists(store.getState());
  const likes = all.find((p) => p.name === `Chloe's Likes of ${YEAR}`);
  const dislikes = all.find((p) => p.name === `Chloe's Dislikes of ${YEAR}`);
  expect(likes.trackIds).toStrictEqual(['r1']);
  expect(dislikes.trackIds).toStrictEqual(['r2']);
  // reactions are separate from `favorites`, so no Favorite Tracks list appears
  expect(names().some((n) => n.startsWith('Favorite Tracks of'))).toBe(false);
});
