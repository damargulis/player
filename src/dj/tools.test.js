import {executeTool, recentlyPlayedBrief} from './tools';
import DJPlaylist from '../playlist/DJPlaylist';
import EmptyPlaylist from '../playlist/EmptyPlaylist';
import RandomAlbumPlaylist from '../playlist/RandomAlbumPlaylist';
import {PLAY_PAUSE, SET_PLAYLIST, UPDATE_LIBRARY} from '../redux/actionTypes';
import store from '../redux/store';

function track(id, name, albumId, playCount = 0, daysSincePlay = 0) {
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
    playCount,
    playDate: playCount ? new Date(Date.now() - daysSincePlay * 24 * 60 * 60 * 1000) : new Date(0),
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
      tracks: {
        t1: track('t1', 'One', 'al1', 9, 3),
        t2: track('t2', 'Two', 'al1', 7, 10),
        t3: track('t3', 'Three', 'al2'),
      },
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

test('taking over inherits the app queue and leaves playback untouched', () => {
  // SET_PLAYLIST with play:true advances the playlist itself, landing on al1's first track.
  const appPlaylist = new RandomAlbumPlaylist([store.getState().library.albums.al1]);
  store.dispatch({payload: {play: true, playlist: appPlaylist}, type: SET_PLAYLIST});
  expect(store.getState().currentlyPlaying.currentlyPlayingId).toBe('t1');
  expect(appPlaylist.getUpcoming()).toStrictEqual(['t2']);

  executeTool('add_to_queue', {track_ids: ['t3'], position: 'end'});

  const after = store.getState().currentlyPlaying;
  expect(after.playlist).toBeInstanceOf(DJPlaylist);
  // same track, still playing, nothing re-selected
  expect(after.currentlyPlayingId).toBe('t1');
  expect(after.isPlaying).toBe(true);
  // t2 was the app's queue and survives the takeover, ahead of the DJ's addition
  expect(after.playlist.getUpcoming()).toStrictEqual(['t2', 't3']);
});

test('a paused track is adopted without being resumed', () => {
  const appPlaylist = new RandomAlbumPlaylist([store.getState().library.albums.al1]);
  store.dispatch({payload: {play: true, playlist: appPlaylist}, type: SET_PLAYLIST});
  store.dispatch({type: PLAY_PAUSE});
  expect(store.getState().currentlyPlaying.isPlaying).toBe(false);

  executeTool('add_to_queue', {track_ids: ['t3']});

  expect(store.getState().currentlyPlaying.isPlaying).toBe(false);
  expect(store.getState().currentlyPlaying.currentlyPlayingId).toBe('t1');
});

test('now_playing works before the DJ queue exists and names what it would inherit', () => {
  const appPlaylist = new RandomAlbumPlaylist([store.getState().library.albums.al1]);
  store.dispatch({payload: {play: true, playlist: appPlaylist}, type: SET_PLAYLIST});

  const outcome = executeTool('now_playing', {});

  expect(outcome.isError).toBeUndefined();
  expect(outcome.content).toContain('The DJ queue is NOT active yet');
  expect(outcome.content).toContain('1 track(s) queued that you would inherit');
  expect(store.getState().currentlyPlaying.playlist).not.toBeInstanceOf(DJPlaylist);
});

test('track lines carry the album track number', () => {
  const outcome = executeTool('search_library', {query: 'Two'});

  expect(outcome.content).toContain('First Album #2/2');
});

test('album play stats come from the tracks, not the never-incremented album field', () => {
  // al1's own playCount stays 0 (playback only increments track.playCount), but its
  // tracks have 9 and 7 plays, so it must not report as unplayed.
  const played = executeTool('search_albums', {query: 'First'});

  expect(played.content).toContain('plays:16 (~8/track)');
  expect(played.content).toContain('last:3 days ago');
  expect(played.content).not.toContain('unplayed');

  const unplayed = executeTool('search_albums', {query: 'Second'});
  expect(unplayed.content).toContain('unplayed');
});

test('album play filters use the derived stats', () => {
  expect(executeTool('search_albums', {unplayed_only: true}).content).toContain('Second Album');
  expect(executeTool('search_albums', {unplayed_only: true}).content).not.toContain('First Album');
  expect(executeTool('search_albums', {min_play_count: 5}).content).toContain('First Album');
  expect(executeTool('search_albums', {min_play_count: 5}).content).not.toContain('Second Album');
  expect(executeTool('search_albums', {min_play_count: 20}).content).toBe('No albums match those filters.');
});

test('get_artist reports album plays from tracks too', () => {
  const outcome = executeTool('get_artist', {name: 'Some Artist'});

  expect(outcome.content).toContain('First Album (2000) — 2 tracks, 16 plays (~8/track)');
  expect(outcome.content).toContain('Second Album (2001) — 1 tracks, unplayed');
});

test('recent_plays lists what was played lately, newest first', () => {
  const outcome = executeTool('recent_plays', {days: 30});

  expect(outcome.isError).toBeUndefined();
  // t1 was played 3 days ago, t2 10 days ago, t3 never
  expect(outcome.content).toContain('2 track(s) played in the last 30 days');
  expect(outcome.content.indexOf('One')).toBeLessThan(outcome.content.indexOf('Two'));
  expect(outcome.content).not.toContain('Three');
});

test('library_stats profiles the library without needing memory', () => {
  const outcome = executeTool('library_stats', {});

  expect(outcome.content).toContain('Library: 3 tracks, 2 albums, 1 artists');
  expect(outcome.content).toContain('16 plays');
  expect(outcome.content).toContain('Top artists by plays: Some Artist (16)');
});

test('now_playing reports the listening context', () => {
  const playlist = new DJPlaylist();
  playlist.setUpcoming(['t1']);
  store.dispatch({payload: {play: true, playlist}, type: SET_PLAYLIST});

  const outcome = executeTool('now_playing', {});

  expect(outcome.content).toContain('Context:');
  expect(outcome.content).toContain('volume');
  expect(outcome.content).toContain('1 track(s) played this set');
  expect(outcome.content).not.toContain('window');
});

test('the opening brief lists what was just played, newest first', () => {
  const brief = recentlyPlayedBrief(store.getState(), 30);

  expect(brief).toContain('Recently played');
  expect(brief).toContain('One — Some Artist');
  expect(brief).toContain('Two — Some Artist');
  // t3 has never been played, so it must not appear
  expect(brief).not.toContain('Three —');
  // t1 was played 3 days ago, t2 ten days ago
  expect(brief.indexOf('One —')).toBeLessThan(brief.indexOf('Two —'));
});

test('the opening brief says so plainly when nothing is recent', () => {
  const brief = recentlyPlayedBrief(store.getState(), 1);

  expect(brief).toContain('nothing in the last 1 days');
});

test('the opening brief caps how much it lists', () => {
  const brief = recentlyPlayedBrief(store.getState(), 30, 1);

  expect(brief).toContain('2 tracks in total');
  expect(brief).toContain('the 1 most recent are listed');
});

describe('concert info reaches only the right tools', () => {
  const CACHE = `${require('../constants').DATA_DIR}/concerts.json`;

  beforeEach(() => {
    const fs = require('fs');
    fs.writeFileSync(CACHE, JSON.stringify({
      concerts: [{
        artistIds: ['ar1'], city: 'New York', date: '2026-11-14',
        id: 'ev1', name: 'Show', region: 'NY', url: 'https://tix', venue: 'Webster Hall',
      }],
      fetchedAt: Date.now(),
      location: {label: 'New York, NY', lat: 40.77, lon: -73.95, radiusMiles: 25, windowDays: 120},
      unseen: [],
      usage: {calls: 0, month: '2026-10'},
    }));
    require('./concertInfo').resetConcertInfo();
  });

  afterEach(() => {
    const fs = require('fs');
    if (fs.existsSync(CACHE)) {
      fs.unlinkSync(CACHE);
    }
    require('./concertInfo').resetConcertInfo();
  });

  it('shows up when looking an artist up', () => {
    const out = executeTool('get_artist', {name: 'Some Artist'});
    expect(out.content).toContain('Upcoming shows near the listener');
    expect(out.content).toContain('Nov 14 at Webster Hall, New York');
  });

  it('shows up on the artist browse list', () => {
    expect(executeTool('list_artists', {}).content).toContain('playing Nov 14');
  });

  it('stays out of the tools used to pick tracks', () => {
    // this is the whole point: a tour date next to a candidate skews selection
    expect(executeTool('search_library', {query: 'One'}).content).not.toContain('Nov 14');
    expect(executeTool('sample_tracks', {}).content).not.toContain('Nov 14');
    expect(executeTool('search_albums', {}).content).not.toContain('Nov 14');
  });

  it('is answerable on request', () => {
    const out = executeTool('concerts', {});
    expect(out.content).toContain('Some Artist — Nov 14 at Webster Hall');
  });

  it('filters by artist and window on request', () => {
    expect(executeTool('concerts', {artist: 'Nobody'}).content).toContain('No upcoming shows');
    expect(executeTool('concerts', {days: 1}).content).toContain('No upcoming shows');
  });
});
