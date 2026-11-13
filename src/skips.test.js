import {recordSkip} from "./skips";

/**
 * `Track.skipCount` has been frozen since the iTunes import — 17,140 skips across 5,658 tracks,
 * all of them history from another program, because nothing in this app ever incremented it.
 */
const track = (extra) => Object.assign({
  albumIds: [], artistIds: [], favorites: [], genreIds: [], id: "t1",
  name: "Song", playCount: 3, skipCount: 2,
}, extra || {});

describe("recordSkip", () => {
  it("increments the skip count", () => {
    expect(recordSkip(track(), 30000)).toEqual({skipCount: 3});
  });

  it("starts from zero on a track the import left unskipped", () => {
    expect(recordSkip(track({skipCount: 0}), 30000)).toEqual({skipCount: 1});
  });

  /** A couple of seconds in is a mis-click, not a verdict on the song. */
  it("ignores a skip within the first two seconds", () => {
    expect(recordSkip(track(), 500)).toBeUndefined();
    expect(recordSkip(track(), 1999)).toBeUndefined();
    expect(recordSkip(track(), 2000)).toEqual({skipCount: 3});
  });

  it("does nothing without a track", () => {
    expect(recordSkip(undefined, 30000)).toBeUndefined();
  });
});

describe("rewind marker", () => {
  const {noteRewind, takeRewind} = require("./skips");

  /**
   * Going back is not a skip — abandoning a song to replay the previous one says nothing about
   * the song. The track-change recorder in App cannot see the direction, so the two backwards
   * action creators mark it.
   */
  it("reports a rewind once and then clears", () => {
    noteRewind();
    expect(takeRewind()).toBe(true);
    expect(takeRewind()).toBe(false);
  });

  it("is false when nothing marked it, so a forward change still counts", () => {
    takeRewind();
    expect(takeRewind()).toBe(false);
  });

  /** Marking twice must not leak into a later, genuine skip. */
  it("does not stack", () => {
    noteRewind();
    noteRewind();
    expect(takeRewind()).toBe(true);
    expect(takeRewind()).toBe(false);
  });
});

describe("the backwards action creators mark a rewind", () => {
  const actions = require("./redux/actions");
  const {takeRewind} = require("./skips");

  beforeEach(() => takeRewind());

  it("prevTrack marks it", () => {
    actions.prevTrack();
    expect(takeRewind()).toBe(true);
  });

  it("prevAlbum marks it", () => {
    actions.prevAlbum();
    expect(takeRewind()).toBe(true);
  });

  /** The forward ones must not, or every skip would be discarded as a rewind. */
  it("nextTrack and nextAlbum do not", () => {
    actions.nextTrack();
    expect(takeRewind()).toBe(false);
    actions.nextAlbum();
    expect(takeRewind()).toBe(false);
  });

  it("still returns the action it always did", () => {
    expect(actions.prevTrack().type).toBe("PREV_TRACK");
    expect(actions.prevAlbum().type).toBe("PREV_ALBUM");
  });
});

describe("recordTrackChange", () => {
  const {noteRewind, recordTrackChange, takeRewind} = require("./skips");

  beforeEach(() => takeRewind());

  /**
   * This is the rule every route now goes through. Before it, only the on-screen next-track
   * button recorded anything, so Cmd+0, both phones, the next-album button and the DJ's own
   * skip_current logged nothing — five days of listening produced 388 plays and zero skips.
   */
  it("counts advancing away from an unfinished track", () => {
    expect(recordTrackChange(track(), 30000, false)).toEqual({skipCount: 3});
  });

  it("does not count a track that finished on its own", () => {
    expect(recordTrackChange(track(), 30000, true)).toBeUndefined();
  });

  it("does not count going back", () => {
    noteRewind();
    expect(recordTrackChange(track(), 30000, false)).toBeUndefined();
  });

  it("consumes the rewind, so the next forward change still counts", () => {
    noteRewind();
    recordTrackChange(track(), 30000, false);
    expect(recordTrackChange(track(), 30000, false)).toEqual({skipCount: 3});
  });

  it("keeps the two-second floor", () => {
    expect(recordTrackChange(track(), 1999, false)).toBeUndefined();
  });

  it("does nothing on the first track, where there is no previous one", () => {
    expect(recordTrackChange(undefined, 30000, false)).toBeUndefined();
  });

  /** A natural finish must clear the marker too, or it would leak into the next change. */
  it("clears a rewind even when the track finished naturally", () => {
    noteRewind();
    expect(recordTrackChange(track(), 30000, true)).toBeUndefined();
    expect(takeRewind()).toBe(false);
  });
});
