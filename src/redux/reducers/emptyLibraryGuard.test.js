import fs from 'fs';
import {DATA_DIR} from '../../constants';
import store from '../store';
import {UPDATE_LIBRARY} from '../actionTypes';

/**
 * The guard refuses to write a track-less library over a real one — correctly, since a single
 * failed load once became permanent loss that way. It also used to `alert`, and these tests run
 * *inside* a renderer, so any suite that dispatched an empty library stopped the whole run
 * behind a modal nobody was watching; the run only finished if someone dismissed it by hand.
 *
 * `window.alert`, not `global.alert`: the bare call in the reducer resolves to the window's,
 * so stubbing the global intercepts nothing and the test would pass either way.
 */
const FILE = `${DATA_DIR}/library.json`;

let realAlert;
let alerts;

beforeEach(() => {
  alerts = [];
  realAlert = window.alert;
  window.alert = (message) => alerts.push(message);
  // Over EMPTY_LIBRARY_BYTES (1024), or the guard reads the file as already empty and lets the
  // write through — which is how the first version of this test passed without testing anything.
  const tracks = {};
  for (let i = 0; i < 40; i++) {
    tracks[`real${i}`] = {id: `real${i}`, name: `Something Worth Keeping ${i}`};
  }
  fs.writeFileSync(FILE, JSON.stringify({
    albums: {}, artists: {}, genres: {}, newTracks: [], playlists: {}, tracks,
  }));
  expect(fs.statSync(FILE).size).toBeGreaterThan(1024);
});

afterEach(() => {
  window.alert = realAlert;
});

test('refuses the write without putting a modal in front of the run', () => {
  store.dispatch({payload: {library: {albums: {}, artists: {}, tracks: {}}}, type: UPDATE_LIBRARY});
  expect(alerts).toEqual([]);
  // and the refusal itself still happened: the file was never queued for overwriting
  // after the write would have landed, had it been allowed through
  return new Promise((resolve) => setTimeout(resolve, 50)).then(() => {
    const onDisk = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    expect(Object.keys(onDisk.tracks).length).toBe(40);
  });
});
