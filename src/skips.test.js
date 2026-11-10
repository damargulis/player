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
