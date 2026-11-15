import activity from './activity';
import DJPlaylist from '../playlist/DJPlaylist';
import {SET_PLAYLIST, UPDATE_LIBRARY} from '../redux/actionTypes';
import {SYSTEM_PROMPT} from './session';
import store from '../redux/store';

/**
 * The DJ wound a set down at a dinner party, having read "last listener input 48m ago" as an
 * empty room. Every track was playing through to the end at the time. Two things made that
 * possible: a room line that mentioned only the chat silence, and an instruction that treated
 * "a long pause with no input" as evidence nobody was there.
 *
 * Both are pinned here because both are prose, and prose is what gets quietly reworded.
 */

const track = {
  albumIds: [], artistIds: [], dateAdded: new Date(0), duration: 180000, favorites: [],
  filePath: 'file:///music/t1.mp3', genreIds: [], id: 't1', name: 'One', playCount: 0,
  playDate: new Date(0), skipCount: 0, year: 2000,
};

beforeEach(() => {
  store.dispatch({
    payload: {library: {albums: {}, artists: {}, tracks: {t1: track}}},
    type: UPDATE_LIBRARY,
  });
});

describe('the room line', () => {
  it('leads with whether the music is actually playing', () => {
    store.dispatch({payload: {play: true, playlist: new DJPlaylist('t1')}, type: SET_PLAYLIST});
    expect(activity.describe()).toContain('Music is playing');
  });

  /** The misreading, made impossible to repeat: quiet is named, and named as normal. */
  it('says a quiet room is not an empty one while the music runs', () => {
    store.dispatch({payload: {play: true, playlist: new DJPlaylist('t1')}, type: SET_PLAYLIST});
    const line = activity.describe();
    expect(line).toContain('not a sign of an empty room');
    expect(line).not.toContain('listener input');
  });

  it('reports a pause as a pause, which is the only real signal', () => {
    store.dispatch({payload: {play: true, playlist: new DJPlaylist('t1')}, type: SET_PLAYLIST});
    store.dispatch({payload: {play: false, playlist: new DJPlaylist('t1')}, type: SET_PLAYLIST});
    expect(activity.describe()).toContain('Playback paused');
  });
});

describe('the standing instruction', () => {
  it('says the set runs until someone says to stop', () => {
    expect(SYSTEM_PROMPT).toContain('The set runs until someone tells you to stop it');
  });

  it('forbids winding down unasked', () => {
    expect(SYSTEM_PROMPT).toContain('Never wind a set down on your own');
    expect(SYSTEM_PROMPT).toContain('never say you are not adding more');
  });

  it('separates silence from an empty room', () => {
    expect(SYSTEM_PROMPT).toContain('Silence is not an empty room');
  });

  it('never tells it that no input means nobody is listening', () => {
    expect(SYSTEM_PROMPT).not.toContain('no input means nobody is listening');
    expect(SYSTEM_PROMPT).not.toContain('room has been idle');
  });

  it('requires a top-up every time the queue runs low', () => {
    expect(SYSTEM_PROMPT).toContain('Always top it up');
  });
});
