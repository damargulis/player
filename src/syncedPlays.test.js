import {
  countsByTrack, latestPlayedAt, notYetApplied, ofType, parseSyncedPlays, syncedTrackUpdates,
} from "./syncedPlays";

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

/**
 * A sync used to dispatch one updateTrack per track, and every mutating action saves the whole
 * library — five seconds of frozen window for 150 tracks. It is one delta now, which means the
 * play and skip halves for a track have to be merged rather than the second overwriting the first.
 */
describe("syncedTrackUpdates", () => {
  const library = {
    t1: {id: "t1", playCount: 10, skipCount: 2, playDate: new Date(1000)},
    t2: {id: "t2", playCount: 0, skipCount: 0, playDate: undefined},
  };
  const getTrack = (id) => library[id];

  it("folds every track into one delta, plays and skips together", () => {
    const events = parseSyncedPlays({
      plays: [{i: "t1", t: 5000}, {i: "t1", t: 7000}, {i: "t2", t: 6000}],
      skips: [{i: "t1", t: 8000}],
      v: 3,
    });
    const updates = syncedTrackUpdates(events, getTrack, 9000);
    expect(Object.keys(updates).sort()).toEqual(["t1", "t2"]);
    expect(updates.t1).toEqual({playCount: 12, playDate: new Date(7000), skipCount: 3});
    expect(updates.t2).toEqual({playCount: 1, playDate: new Date(6000)});
  });

  it("never rewinds playDate and leaves unknown tracks out", () => {
    const events = parseSyncedPlays({
      plays: [{i: "t1", t: 500}, {i: "gone", t: 600}],
      skips: [{i: "gone", t: 700}],
      v: 3,
    });
    const updates = syncedTrackUpdates(events, getTrack, 9000);
    expect(Object.keys(updates)).toEqual(["t1"]);
    expect(updates.t1.playDate).toEqual(new Date(1000));
  });

  it("gives an untimed play the sync moment", () => {
    const updates = syncedTrackUpdates(parseSyncedPlays({t2: 2}), getTrack, 9000);
    expect(updates.t2).toEqual({playCount: 2, playDate: new Date(9000)});
  });
});

/**
 * The phone resends everything a sync did not acknowledge, so a reply lost after the desktop had
 * applied the plays brings them back a second time. The log is what says they were applied.
 */
describe("notYetApplied", () => {
  const log = [
    {type: "play", id: "t1", at: 5000, source: "phone", estimated: false},
    {type: "skip", id: "t2", at: 6000, source: "phone", estimated: false},
    {type: "play", id: "t3", at: 7000, source: "desktop", estimated: false},
    {type: "play", id: "t4", at: 8000, source: "phone", estimated: true},
  ];

  it("drops phone events the log already holds, by track, type and moment", () => {
    const events = parseSyncedPlays({
      plays: [{i: "t1", t: 5000}, {i: "t1", t: 5001}, {i: "t2", t: 6000}],
      skips: [{i: "t2", t: 6000}],
      v: 3,
    });
    expect(notYetApplied(events, log).map((e) => `${e.type} ${e.id} ${e.at}`))
      .toEqual(["play t1 5001", "play t2 6000"]);
  });

  it("does not match desktop plays or estimated stamps, and always passes untimed counts", () => {
    const events = parseSyncedPlays({counts: {t9: 2}, plays: [{i: "t3", t: 7000}, {i: "t4", t: 8000}], v: 3});
    expect(notYetApplied(events, log)).toHaveLength(3);
  });
});
