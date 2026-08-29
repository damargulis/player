import {executeTool} from './tools';
import DJPlaylist from '../playlist/DJPlaylist';
import EmptyPlaylist from '../playlist/EmptyPlaylist';
import RandomAlbumPlaylist from '../playlist/RandomAlbumPlaylist';
import {SET_PLAYLIST, UPDATE_LIBRARY} from '../redux/actionTypes';
import store from '../redux/store';

function track(id, name, albumId) {
  return {
    albumIds: [albumId],
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

beforeEach(() => {
  store.dispatch({
    payload: {library: {
      albums: {
        al1: {albumArtFile: undefined, artistIds: ['ar1'], errors: [], favorites: [], genreIds: [], id: 'al1',
          name: 'First Album', playCount: 0, skipCount: 0, trackIds: ['t1', 't2'], year: 2000},
        al2: {albumArtFile: undefined, artistIds: ['ar1'], errors: [], favorites: [], genreIds: [], id: 'al2',
          name: 'Second Album', playCount: 0, skipCount: 0, trackIds: ['t3'], year: 2001},
      },
      artists: {
        ar1: {albumIds: ['al1', 'al2'], errors: [], genreIds: [], id: 'ar1', name: 'Some Artist',
          trackIds: ['t1', 't2', 't3']},
      },
      tracks: {t1: track('t1', 'One', 'al1'), t2: track('t2', 'Two', 'al1'), t3: track('t3', 'Three', 'al2')},
    }},
    type: UPDATE_LIBRARY,
  });
  // Cold start: the app's startup state — a non-DJ playlist and nothing playing.
  store.dispatch({payload: {play: false, playlist: new RandomAlbumPlaylist([])}, type: SET_PLAYLIST});
});

afterEach(() => {
  store.dispatch({payload: {play: false, playlist: new EmptyPlaylist()}, type: SET_PLAYLIST});
});

test('queue_albums starts playback from a cold app with nothing playing', () => {
  const outcome = executeTool('queue_albums', {album_ids: ['al1']});

  expect(outcome.isError).toBeUndefined();
  const state = store.getState();
  expect(state.currentlyPlaying.playlist).toBeInstanceOf(DJPlaylist);
  expect(state.currentlyPlaying.currentlyPlayingId).toBe('t1');
  expect(state.currentlyPlaying.isPlaying).toBe(true);
  expect(state.currentlyPlaying.playlist.getUpcoming()).toStrictEqual(['t2']);
  // Album-tagged, so the album transport buttons work on it.
  expect(state.currentlyPlaying.playlist.hasNextAlbum()).toBe(true);
});

test('set_queue starts playback from a cold app with nothing playing', () => {
  const outcome = executeTool('set_queue', {track_ids: ['t3', 't1']});

  expect(outcome.isError).toBeUndefined();
  const state = store.getState();
  expect(state.currentlyPlaying.playlist).toBeInstanceOf(DJPlaylist);
  expect(state.currentlyPlaying.currentlyPlayingId).toBe('t3');
  expect(state.currentlyPlaying.isPlaying).toBe(true);
});

test('taking over mid-playback keeps the current track and does not restart it', () => {
  const playing = new RandomAlbumPlaylist([]);
  store.dispatch({payload: {play: false, playlist: playing}, type: SET_PLAYLIST});
  store.dispatch({payload: {library: {tracks: {}}}, type: UPDATE_LIBRARY});
  // Simulate something already playing.
  const djSeed = new DJPlaylist('t2');
  store.dispatch({payload: {play: true, playlist: djSeed}, type: SET_PLAYLIST});
  expect(store.getState().currentlyPlaying.currentlyPlayingId).toBe('t2');

  executeTool('add_to_queue', {track_ids: ['t3'], position: 'end'});

  const state = store.getState();
  expect(state.currentlyPlaying.currentlyPlayingId).toBe('t2'); // unchanged — no restart
  expect(state.currentlyPlaying.playlist.getUpcoming()).toStrictEqual(['t3']);
});

test('add_to_queue on an empty library reports unknown ids instead of activating', () => {
  const outcome = executeTool('add_to_queue', {track_ids: ['nope']});

  expect(outcome.isError).toBe(true);
  expect(outcome.content).toContain('None of those ids exist');
  expect(store.getState().currentlyPlaying.playlist).not.toBeInstanceOf(DJPlaylist);
});
