import {NEXT_TRACK, SET_PLAYLIST, UPDATE_LIBRARY} from '../redux/actionTypes';
import DJPlaylist from '../playlist/DJPlaylist';
import RandomAlbumPlaylist from '../playlist/RandomAlbumPlaylist';
import {executeTool} from './tools';
import session from './session';
import store from '../redux/store';

function track(id, name) {
  return {
    albumIds: ['al1'], artistIds: ['ar1'], dateAdded: new Date(0), duration: 180000,
    favorites: [], filePath: `file:///music/${id}.mp3`, genreIds: [], id, name,
    playCount: 0, playDate: new Date(0), skipCount: 0, year: 2000,
  };
}

beforeEach(() => {
  store.dispatch({
    payload: {library: {
      albums: {al1: {albumArtFile: undefined, artistIds: ['ar1'], errors: [], favorites: [],
        genreIds: [], id: 'al1', name: 'Album', playCount: 0, skipCount: 0,
        trackIds: ['t1', 't2', 't3'], year: 2000}},
      artists: {ar1: {albumIds: ['al1'], errors: [], genreIds: [], id: 'ar1', name: 'Artist',
        trackIds: ['t1', 't2', 't3']}},
      tracks: {t1: track('t1', 'One'), t2: track('t2', 'Two'), t3: track('t3', 'Three')},
    }},
    type: UPDATE_LIBRARY,
  });
  store.dispatch({payload: {play: false, playlist: new RandomAlbumPlaylist([])}, type: SET_PLAYLIST});
});

function playlist() {
  return store.getState().currentlyPlaying.playlist;
}

describe('end_session', () => {
  it('hands the queue back to album shuffle', () => {
    executeTool('set_queue', {track_ids: ['t1', 't2']});
    expect(playlist() instanceof DJPlaylist).toBe(true);

    const outcome = executeTool('end_session', {});
    expect(outcome.isError).toBeFalsy();
    expect(playlist() instanceof RandomAlbumPlaylist).toBe(true);
  });

  // The whole point of SWAP_PLAYLIST: the track that is playing is not restarted or cut off,
  // so "end the session" never sounds like a skip.
  it('leaves what is playing alone', () => {
    executeTool('set_queue', {track_ids: ['t1', 't2', 't3']});
    store.dispatch({type: NEXT_TRACK});
    const playingBefore = store.getState().currentlyPlaying.currentlyPlayingId;
    expect(playingBefore).toBeTruthy();

    executeTool('end_session', {});
    expect(store.getState().currentlyPlaying.currentlyPlayingId).toEqual(playingBefore);
  });

  // isActive() just asks whether the playlist is a DJPlaylist, so handing back IS ending the
  // set — there is no separate flag that could disagree with what is actually playing.
  it('ends the set as far as the session is concerned', () => {
    executeTool('set_queue', {track_ids: ['t1']});
    expect(session.isActive()).toBe(true);
    executeTool('end_session', {});
    expect(session.isActive()).toBe(false);
  });

  it('lets a new set start afterwards', () => {
    executeTool('set_queue', {track_ids: ['t1']});
    executeTool('end_session', {});
    executeTool('set_queue', {track_ids: ['t2']});
    expect(session.isActive()).toBe(true);
  });

  it('works even when the DJ never took the queue over', () => {
    expect(session.isActive()).toBe(false);
    expect(executeTool('end_session', {}).isError).toBeFalsy();
    expect(playlist() instanceof RandomAlbumPlaylist).toBe(true);
  });
});
