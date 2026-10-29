import DJPlaylist, {DJ_ACTOR} from '../playlist/DJPlaylist';
import EmptyPlaylist from '../playlist/EmptyPlaylist';
import {NEXT_ALBUM, NEXT_TRACK, SET_PLAYLIST, UPDATE_LIBRARY, UPDATE_TIME, UPDATE_TRACK} from '../redux/actionTypes';
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
      artists: {ar1: {albumIds: ['al1'], errors: [], genreIds: [], id: 'ar1', name: 'Artist',
        trackIds: ['t1', 't2', 't3', 't4']}},
      tracks: {t1: track('t1', 'One'), t2: track('t2', 'Two'), t3: track('t3', 'Three'), t4: track('t4', 'Four')},
      albums: {
        al1: {albumArtFile: undefined, artistIds: ['ar1'], errors: [], favorites: [], genreIds: [], id: 'al1',
          name: 'Album', playCount: 0, skipCount: 0, trackIds: ['t1', 't2', 't3'], year: 2000},
        al2: {albumArtFile: undefined, artistIds: ['ar1'], errors: [], favorites: [], genreIds: [], id: 'al2',
          name: 'Other', playCount: 0, skipCount: 0, trackIds: ['t4'], year: 2001},
      },
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

  expect(outcome.content).toContain('skipped after');
  expect(session.getStatus().recentSkips).toBe(0);
  // A later skip starts a fresh streak rather than re-firing immediately.
  playFor(5);
  expect(session.getStatus().recentSkips).toBe(1);
});

test('hand-pruned tracks are reported to the DJ as explicit feedback', () => {
  const playlist = store.getState().currentlyPlaying.playlist;
  playlist.removeUpcoming(['t3']);
  session.noteListenerRemoval(['t3']);

  const outcome = session.runExternalTool('get_queue', {});

  expect(outcome.content).toContain('Daniel removed from the queue');
  expect(outcome.content).toContain('Three');
});

test('the room line reports idle and pause state', () => {
  const outcome = session.runExternalTool('now_playing', {});

  expect(outcome.content).toContain('Room:');
  expect(JSON.parse(session.runExternalTool('_status', {}).content).room).toEqual(
    expect.objectContaining({idleSeconds: expect.anything()}),
  );
});

test('a skip names whoever did it', () => {
  const playlist = new DJPlaylist();
  playlist.setUpcoming(['t1', 't2', 't3']);
  store.dispatch({payload: {play: true, playlist}, type: SET_PLAYLIST});
  session.runExternalTool('get_queue', {}); // drain

  // the desktop and android don't announce themselves, so they are the owner
  playFor(6);
  expect(session.runExternalTool('get_queue', {}).content).toContain('Daniel skipped after');

  // the web app names the person who pressed the button
  playlist.noteActor('Chloe');
  playFor(4);
  const outcome = session.runExternalTool('get_queue', {});
  expect(outcome.content).toContain('Chloe skipped after');
  expect(outcome.content).not.toContain('Daniel skipped after');
});

test("the DJ's own skip is still told apart from a person's", () => {
  const playlist = new DJPlaylist();
  playlist.setUpcoming(['t1', 't2']);
  store.dispatch({payload: {play: true, playlist}, type: SET_PLAYLIST});
  session.runExternalTool('get_queue', {});

  playlist.noteActor(DJ_ACTOR);
  playFor(4);

  const outcome = session.runExternalTool('get_queue', {});
  expect(outcome.content).toContain('You (the DJ) skipped');
  expect(outcome.content).not.toContain('Daniel skipped');
});

test('a removal names whoever did it', () => {
  const playlist = new DJPlaylist();
  playlist.setUpcoming(['t1', 't2', 't3']);
  store.dispatch({payload: {play: true, playlist}, type: SET_PLAYLIST});
  session.runExternalTool('get_queue', {});

  session.removeFromQueue(['t3'], undefined, 'Chloe');

  expect(session.runExternalTool('get_queue', {}).content).toContain('Chloe removed from the queue');
});

test('skipping a whole album reads differently from skipping one track', () => {
  const playlist = new DJPlaylist();
  playlist.addAlbum(['t1', 't2', 't3'], 'al1', 'end');
  playlist.addAlbum(['t4'], 'al2', 'end');
  store.dispatch({payload: {play: true, playlist}, type: SET_PLAYLIST});
  expect(store.getState().currentlyPlaying.currentlyPlayingId).toBe('t1');

  // one track skip
  playFor(5);
  let outcome = session.runExternalTool('get_queue', {});
  expect(outcome.content).toContain('skipped after');
  expect(outcome.content).not.toContain('the rest of');

  // now reject the remainder of the record
  store.dispatch({payload: {time: 7}, type: UPDATE_TIME});
  store.dispatch({type: NEXT_ALBUM});
  expect(store.getState().currentlyPlaying.currentlyPlayingId).toBe('t4');

  outcome = session.runExternalTool('get_queue', {});
  expect(outcome.content).toContain('Daniel skipped the rest of "Album"');
  expect(outcome.content).toContain('1 queued track(s) dropped');
});

test("the DJ's own skip is not reported as listener feedback", () => {
  const playlist = new DJPlaylist();
  playlist.setUpcoming(['t1', 't2']);
  store.dispatch({payload: {play: true, playlist}, type: SET_PLAYLIST});
  session.runExternalTool('get_queue', {}); // drain
  const before = session.getStatus().recentSkips;

  store.dispatch({payload: {time: 4}, type: UPDATE_TIME});
  session.runExternalTool('skip_current', {});

  expect(session.getStatus().recentSkips).toBe(before);
  const outcome = session.runExternalTool('get_queue', {});
  expect(outcome.content).toContain('You (the DJ) skipped');
});

test('favoriting the playing track is reported as a positive signal', () => {
  const playlist = new DJPlaylist();
  playlist.setUpcoming(['t1', 't2']);
  store.dispatch({payload: {play: true, playlist}, type: SET_PLAYLIST});
  session.runExternalTool('get_queue', {}); // drain, and snapshot current favorites
  playFor(5); // a skip, so there is a streak to clear
  expect(session.getStatus().recentSkips).toBe(1);

  store.dispatch({payload: {id: 't2', info: {favorites: [2026]}}, type: UPDATE_TRACK});

  expect(session.getStatus().recentSkips).toBe(0);
  const outcome = session.runExternalTool('get_queue', {});
  expect(outcome.content).toContain('Just favorited:');
});

test('removing a whole album is reported as one rejection, not a wall of tracks', () => {
  const playlist = new DJPlaylist();
  playlist.setUpcoming(['t1']);
  playlist.addAlbum(['t2', 't3'], 'al1', 'end');
  store.dispatch({payload: {play: true, playlist}, type: SET_PLAYLIST});
  session.runExternalTool('get_queue', {}); // drain
  expect(playlist.getUpcoming()).toStrictEqual(['t2', 't3']);

  session.removeFromQueue([], 'al1');

  expect(playlist.getUpcoming()).toStrictEqual([]);
  const outcome = session.runExternalTool('get_queue', {});
  expect(outcome.content).toContain('dropped the rest of "Album"');
  expect(outcome.content).toContain('2 track(s)');
  // not one line per track
  expect(outcome.content).not.toContain('removed from the queue');
});

test('removing single tracks still reports them individually', () => {
  const playlist = new DJPlaylist();
  playlist.setUpcoming(['t1', 't2', 't3']);
  store.dispatch({payload: {play: true, playlist}, type: SET_PLAYLIST});
  session.runExternalTool('get_queue', {});

  session.removeFromQueue(['t3']);

  expect(playlist.getUpcoming()).toStrictEqual(['t2']);
  expect(session.runExternalTool('get_queue', {}).content).toContain('Daniel removed from the queue');
});

test('removing does nothing when the DJ queue is not active', () => {
  store.dispatch({payload: {play: false, playlist: new EmptyPlaylist()}, type: SET_PLAYLIST});
  expect(() => session.removeFromQueue(['t1'])).not.toThrow();
});

describe('speaker labelling', () => {
  // The rule the three clients share. It lived only in their render code before, where the
  // same mistake had to be made three times to be wrong everywhere - and was.
  function shouldLabel(entry, speakers, owner) {
    return Boolean(entry.speaker) && (speakers.length > 1 || entry.speaker !== owner);
  }

  it('labels a guest even when they are the only one talking', () => {
    expect(shouldLabel({speaker: 'Chloe'}, ['Chloe'], 'Daniel')).toBe(true);
  });

  it('leaves the owner unlabelled in a solo session, which is the point of the rule', () => {
    expect(shouldLabel({speaker: 'Daniel'}, ['Daniel'], 'Daniel')).toBe(false);
  });

  it('labels the owner once someone else has spoken', () => {
    expect(shouldLabel({speaker: 'Daniel'}, ['Daniel', 'Chloe'], 'Daniel')).toBe(true);
  });

  it('labels nothing for an entry with no speaker', () => {
    expect(shouldLabel({speaker: null}, ['Daniel', 'Chloe'], 'Daniel')).toBe(false);
  });
});
