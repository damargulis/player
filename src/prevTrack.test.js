import {prevTrack, shouldRestart} from "./redux/actions";
import {PREV_TRACK, SET_TIME} from "./redux/actionTypes";
import {recordTrackChange} from "./skips";

/** A store just big enough for the thunk: the reducer's only job here is moving the id. */
function fakeStore(time, ids, index) {
  let state = {
    currentlyPlaying: {
      currentlyPlayingId: ids[index],
      playlist: {hasPrevTrack: () => index > 0, prevTrack: () => ids[Math.max(0, --index)]},
      time,
    },
  };
  const dispatched = [];
  const dispatch = (action) => {
    dispatched.push(action.type);
    if (action.type === PREV_TRACK) {
      state = {currentlyPlaying: {...state.currentlyPlaying,
        currentlyPlayingId: state.currentlyPlaying.playlist.prevTrack()}};
    }
  };
  return {dispatch, dispatched, getState: () => state};
}

describe("Previous", () => {
  it("restarts a track more than three seconds in", () => {
    const store = fakeStore(42, ["a", "b"], 1);
    prevTrack()(store.dispatch, store.getState);
    expect(store.dispatched).toEqual([SET_TIME]);
  });

  it("goes back within the first three seconds", () => {
    const store = fakeStore(1.5, ["a", "b"], 1);
    prevTrack()(store.dispatch, store.getState);
    expect(store.dispatched).toEqual([PREV_TRACK]);
    expect(store.getState().currentlyPlaying.currentlyPlayingId).toBe("a");
  });

  it("restarts rather than going nowhere when nothing is behind", () => {
    expect(shouldRestart(0, false)).toBe(true);
    expect(shouldRestart(3, true)).toBe(false);
    expect(shouldRestart(3.1, true)).toBe(true);
  });

  it("leaves no rewind marker behind when the track did not change", () => {
    // the playlist claims a previous track but hands back the current one, as DJPlaylist does at
    // its start; the marker it set used to swallow the next real skip
    const store = fakeStore(0, ["a"], 0);
    store.getState().currentlyPlaying.playlist.hasPrevTrack = () => true;
    prevTrack()(store.dispatch, store.getState);
    expect(recordTrackChange({id: "a", skipCount: 0, albumIds: []}).track).toEqual({skipCount: 1});
  });
});
