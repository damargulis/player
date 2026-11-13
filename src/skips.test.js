import {noteNaturalFinish, noteRewind, recordSkip, recordTrackChange, takeRewind} from "./skips";

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
    expect(recordSkip(track())).toEqual({skipCount: 3});
  });

  it("starts from zero on a track the import left unskipped", () => {
    expect(recordSkip(track({skipCount: 0}))).toEqual({skipCount: 1});
  });

  /**
   * No floor: a rejection two seconds in is still a rejection, and a floor made the feature
   * impossible to observe — skipping through a few tracks recorded nothing at all.
   */
  it("counts however briefly the track was heard", () => {
    expect(recordSkip(track())).toEqual({skipCount: 3});
  });

  it("does nothing without a track", () => {
    expect(recordSkip(undefined)).toBeUndefined();
  });
});

describe("rewind marker", () => {
  it("reports a rewind once and then clears", () => {
    noteRewind();
    expect(takeRewind()).toBe(true);
    expect(takeRewind()).toBe(false);
  });

  it("is false when nothing marked it, so a forward change still counts", () => {
    takeRewind();
    expect(takeRewind()).toBe(false);
  });

  it("does not stack", () => {
    noteRewind();
    noteRewind();
    expect(takeRewind()).toBe(true);
    expect(takeRewind()).toBe(false);
  });
});

describe("the backwards action creators mark a rewind", () => {
  const actions = require("./redux/actions");

  beforeEach(() => takeRewind());

  it("prevTrack marks it", () => {
    actions.prevTrack();
    expect(takeRewind()).toBe(true);
  });

  it("prevAlbum marks it", () => {
    actions.prevAlbum();
    expect(takeRewind()).toBe(true);
  });

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
  beforeEach(() => {
    takeRewind();
    noteNaturalFinish(undefined);
  });

  /**
   * The rule every route goes through. Before it, only the on-screen next-track button
   * recorded anything, so Cmd+0, both phones, the next-album button and the DJ's own
   * skip_current logged nothing.
   */
  it("counts advancing away from an unfinished track", () => {
    expect(recordTrackChange(track())).toEqual({skipCount: 3});
  });

  it("does not count the track that reached its own end", () => {
    noteNaturalFinish("t1");
    expect(recordTrackChange(track({id: "t1"}))).toBeUndefined();
  });

  /**
   * Keyed on the id, not a bare flag. `ended` dispatches a play-count update before advancing,
   * which replaces the track object; a boolean was read and cleared by that change, so the
   * real departure was recorded as a skip — and then the skip's own update was too.
   */
  it("still counts a different track leaving after one finished", () => {
    noteNaturalFinish("t1");
    expect(recordTrackChange(track({id: "t2"}))).toEqual({skipCount: 3});
  });

  it("does not count going back", () => {
    noteRewind();
    expect(recordTrackChange(track())).toBeUndefined();
  });

  it("consumes the rewind, so the next forward change still counts", () => {
    noteRewind();
    recordTrackChange(track());
    expect(recordTrackChange(track())).toEqual({skipCount: 3});
  });

  it("does nothing on the first track, where there is no previous one", () => {
    expect(recordTrackChange(undefined)).toBeUndefined();
  });

  it("clears the finish marker so it cannot excuse a later departure", () => {
    noteNaturalFinish("t1");
    expect(recordTrackChange(track({id: "t1"}))).toBeUndefined();
    expect(recordTrackChange(track({id: "t1"}))).toEqual({skipCount: 3});
  });
});

describe("recordRemovals", () => {
  const {recordRemovals} = require("./skips");

  /** X-ing a track out of the queue is the same judgement as pressing next, made earlier. */
  it("counts a removed track as a skip", () => {
    expect(recordRemovals([track()])).toEqual({t1: {skipCount: 3}});
  });

  it("counts each track of a dropped album", () => {
    const updates = recordRemovals([track({id: "a"}), track({id: "b"}), track({id: "c"})]);
    expect(Object.keys(updates).sort()).toEqual(["a", "b", "c"]);
    expect(updates.a).toEqual({skipCount: 3});
  });

  /** A queue can hold the same track twice, and removing both is two rejections. */
  it("counts duplicates rather than collapsing them", () => {
    expect(recordRemovals([track(), track()])).toEqual({t1: {skipCount: 4}});
  });

  it("starts from zero on a track the import left unskipped", () => {
    expect(recordRemovals([track({skipCount: 0})])).toEqual({t1: {skipCount: 1}});
  });

  it("does nothing for an empty removal", () => {
    expect(recordRemovals([])).toEqual({});
  });
});
