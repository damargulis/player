import {countsByTrack, latestPlayedAt, ofType, parseSyncedPlays} from "./syncedPlays";

/**
 * Two wire shapes have to work at once. The original is a bare `{trackId: count}` map — all a
 * phone build could produce before `PlayTracker` kept timestamps — and an older phone against
 * a newer desktop must keep syncing. The new shape carries the moment each play happened,
 * which is the whole point: the desktop's play log can only be as good as what it is told.
 */
describe("parseSyncedPlays", () => {
  it("reads the original bare count map", () => {
    expect(parseSyncedPlays({abc: 2, def: 1})).toEqual([
      {count: 2, id: "abc", type: "play"},
      {count: 1, id: "def", type: "play"},
    ]);
  });

  it("reads timestamped plays, keeping them individual", () => {
    // two plays of the same song hours apart are two facts; folding them into a count is
    // exactly the information the old protocol threw away
    const payload = {v: 2, plays: [{i: "abc", t: 1000}, {i: "abc", t: 9000}]};
    expect(parseSyncedPlays(payload)).toEqual([
      {at: 1000, count: 1, id: "abc", type: "play"},
      {at: 9000, count: 1, id: "abc", type: "play"},
    ]);
  });

  it("reads both halves when a phone still holds pre-timestamp plays", () => {
    const payload = {v: 2, plays: [{i: "abc", t: 1000}], counts: {old: 3}};
    expect(parseSyncedPlays(payload)).toEqual([
      {at: 1000, count: 1, id: "abc", type: "play"},
      {count: 3, id: "old", type: "play"},
    ]);
  });

  it("ignores entries with no id or no usable time", () => {
    const payload = {v: 2, plays: [{i: "", t: 1}, {i: "a"}, {t: 5}, {i: "b", t: 0}]};
    expect(parseSyncedPlays(payload)).toEqual([]);
  });

  it("ignores counts that are zero, negative or not numbers", () => {
    expect(parseSyncedPlays({a: 0, b: -2, c: "lots", d: 1})).toEqual([{count: 1, id: "d", type: "play"}]);
  });

  it("returns nothing for junk rather than throwing", () => {
    expect(parseSyncedPlays(undefined)).toEqual([]);
    expect(parseSyncedPlays("nonsense")).toEqual([]);
    expect(parseSyncedPlays({})).toEqual([]);
    expect(parseSyncedPlays({v: 2})).toEqual([]);
  });
});

describe("countsByTrack", () => {
  it("totals a track across separate plays, which is what playCount needs", () => {
    const plays = [{at: 1, count: 1, id: "a", type: "play"}, {at: 2, count: 1, id: "a", type: "play"}, {count: 3, id: "b", type: "play"}];
    expect(countsByTrack(plays)).toEqual({a: 2, b: 3});
  });
});

describe("latestPlayedAt", () => {
  it("finds the most recent moment a track was played", () => {
    const plays = [{at: 500, count: 1, id: "a", type: "play"}, {at: 900, count: 1, id: "a", type: "play"}];
    expect(latestPlayedAt(plays, "a")).toEqual(900);
  });

  it("is undefined when the phone could not say when", () => {
    expect(latestPlayedAt([{count: 2, id: "a", type: "play"}], "a")).toBeUndefined();
  });

  it("ignores other tracks", () => {
    expect(latestPlayedAt([{at: 900, count: 1, id: "b", type: "play"}], "a")).toBeUndefined();
  });
});

/**
 * v3 adds skips. The phone counts one the same way the desktop does, with the same two-second
 * floor, so a phone skip and a desktop skip mean the same thing.
 */
describe("skips over the wire", () => {
  it("reads timestamped skips alongside plays", () => {
    const payload = {v: 3, plays: [{i: "a", t: 100}], skips: [{i: "b", t: 200}]};
    expect(parseSyncedPlays(payload)).toEqual([
      {at: 100, count: 1, id: "a", type: "play"},
      {at: 200, count: 1, id: "b", type: "skip"},
    ]);
  });

  it("separates them for the counters they belong to", () => {
    const events = parseSyncedPlays({v: 3, plays: [{i: "a", t: 1}], skips: [{i: "b", t: 2}]});
    expect(countsByTrack(ofType(events, "play"))).toEqual({a: 1});
    expect(countsByTrack(ofType(events, "skip"))).toEqual({b: 1});
  });

  /** A v2 phone sends no skips at all, which is not an error. */
  it("reads a payload with no skips field", () => {
    expect(parseSyncedPlays({v: 2, plays: [{i: "a", t: 1}]}))
      .toEqual([{at: 1, count: 1, id: "a", type: "play"}]);
  });

  it("reads a payload that is only skips", () => {
    expect(parseSyncedPlays({v: 3, skips: [{i: "b", t: 2}]}))
      .toEqual([{at: 2, count: 1, id: "b", type: "skip"}]);
  });

  /** The bare count map predates both and can only mean plays. */
  it("still treats the original map as plays", () => {
    expect(parseSyncedPlays({abc: 2})).toEqual([{count: 2, id: "abc", type: "play"}]);
  });
});
