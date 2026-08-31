import DJPlaylist from '../playlist/DJPlaylist';
import EmptyPlaylist from '../playlist/EmptyPlaylist';
import {NEXT_TRACK, SET_PLAYLIST, UPDATE_LIBRARY, UPDATE_TIME} from '../redux/actionTypes';
import session from './session';
import store from '../redux/store';

function track(id, name) {
  return {
    albumIds: ['al1'],
    artistIds: ['ar1'],
    dateAdded: new Date(0),
    duration: 180000,
    favorites: [],
    filePath: `file:///music/${id}.mp3`,
    genreIds: [],
    id,
    name,
    playCount: 0,
    playDate: new Date(0),
    skipCount: 0,
    year: 2000,
  };
}

/** Advances to the next queued track after `seconds` of playback (a skip if well short of the end). */
function playFor(seconds) {
  store.dispatch({payload: {time: seconds}, type: UPDATE_TIME});
  store.dispatch({type: NEXT_TRACK});
}

beforeEach(() => {
  store.dispatch({
    payload: {library: {
      albums: {al1: {albumArtFile: undefined, artistIds: ['ar1'], errors: [], favorites: [], genreIds: [], id: 'al1',
        name: 'Album', playCount: 0, skipCount: 0, trackIds: ['t1', 't2', 't3', 't4'], year: 2000}},
      artists: {ar1: {albumIds: ['al1'], errors: [], genreIds: [], id: 'ar1', name: 'Artist',
        trackIds: ['t1', 't2', 't3', 't4']}},
      tracks: {t1: track('t1', 'One'), t2: track('t2', 'Two'), t3: track('t3', 'Three'), t4: track('t4', 'Four')},
    }},
    type: UPDATE_LIBRARY,
  });
  const playlist = new DJPlaylist();
  playlist.setUpcoming(['t1', 't2', 't3', 't4']);
  store.dispatch({payload: {play: true, playlist}, type: SET_PLAYLIST});
});

afterEach(() => {
  store.dispatch({payload: {play: false, playlist: new EmptyPlaylist()}, type: SET_PLAYLIST});
  session.runExternalTool('get_queue', {}); // drain any feedback so tests don't bleed into each other
});

test('consecutive skips accumulate, and a full play resets the streak', () => {
  playFor(10);
  expect(session.getStatus().recentSkips).toBe(1);
  playFor(8);
  expect(session.getStatus().recentSkips).toBe(2);
  playFor(180); // played to the end
  expect(session.getStatus().recentSkips).toBe(0);
});

test('delivering the feedback clears the streak, so one bad patch wakes the DJ once', () => {
  playFor(10);
  playFor(8);
  expect(session.getStatus().recentSkips).toBe(2);

  const outcome = session.runExternalTool('get_queue', {});

  expect(outcome.content).toContain('Skipped after');
  expect(session.getStatus().recentSkips).toBe(0);
  // A later skip starts a fresh streak rather than re-firing immediately.
  playFor(5);
  expect(session.getStatus().recentSkips).toBe(1);
});
