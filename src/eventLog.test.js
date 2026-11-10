import {dayOf, ofType, onlyPlays, parseEntry, playsByDay, playsByHour, playsByTrack,
  since} from "./eventLog";

/**
 * The log is the listening history `Track.playDate` cannot be — that holds one date per song.
 * These cover the reading and aggregating; appending touches DATA_DIR and is exercised by use.
 */
const line = (obj) => JSON.stringify(obj);

describe("parseEntry", () => {
  it("reads a minimal desktop play", () => {
    expect(parseEntry(line({at: 1000, id: "abc"}))).toEqual({
      at: 1000, count: 1, estimated: false, id: "abc", source: "desktop",
      subject: "track", type: "play", value: undefined, who: undefined,
    });
  });

  it("reads a phone play with a count and an estimated time", () => {
    expect(parseEntry(line({at: 1000, id: "abc", n: 3, src: "phone", est: true}))).toEqual({
      at: 1000, count: 3, estimated: true, id: "abc", source: "phone",
      subject: "track", type: "play", value: undefined, who: undefined,
    });
  });

  /** A crash mid-append leaves a torn line; it must cost that line and not the file. */
  it("skips a torn or junk line rather than throwing", () => {
    expect(parseEntry('{"at":1000,"id":"ab')).toBeUndefined();
    expect(parseEntry("")).toBeUndefined();
    expect(parseEntry("   ")).toBeUndefined();
    expect(parseEntry("null")).toBeUndefined();
  });

  it("skips an entry with no id or no time", () => {
    expect(parseEntry(line({at: 1000}))).toBeUndefined();
    expect(parseEntry(line({id: "abc"}))).toBeUndefined();
    expect(parseEntry(line({at: 0, id: "abc"}))).toBeUndefined();
  });
});

describe("aggregates", () => {
  const at = (y, m, d, h) => new Date(y, m - 1, d, h).getTime();
  const entries = [
    {at: at(2026, 11, 4, 9), count: 1, estimated: false, id: "a", source: "desktop"},
    {at: at(2026, 11, 4, 22), count: 1, estimated: false, id: "b", source: "desktop"},
    {at: at(2026, 11, 5, 22), count: 1, estimated: false, id: "a", source: "phone"},
    {at: at(2026, 11, 5, 3), count: 5, estimated: true, id: "c", source: "phone"},
  ];

  it("groups by local day", () => {
    expect(playsByDay(entries)).toEqual({"2026-11-04": 2, "2026-11-05": 6});
  });

  it("groups by hour of the day", () => {
    const hours = playsByHour(entries);
    expect(hours[9]).toEqual(1);
    expect(hours[22]).toEqual(2);
  });

  /** An estimated time is a sync time; counting it would pile a day onto one hour. */
  it("leaves estimated entries out of the hour breakdown", () => {
    expect(playsByHour(entries)[3]).toEqual(0);
    // but they still count toward the day and the track totals
    expect(playsByDay(entries)["2026-11-05"]).toEqual(6);
  });

  it("totals per track, counting multi-play entries", () => {
    expect(playsByTrack(entries)).toEqual({a: 2, b: 1, c: 5});
  });

  it("windows by local midnight, inclusive of today", () => {
    const now = at(2026, 11, 5, 12);
    expect(since(entries, 1, now).map((e) => e.id).sort()).toEqual(["a", "c"]);
    expect(since(entries, 2, now).length).toEqual(4);
  });

  it("names the local day of a moment", () => {
    expect(dayOf(at(2026, 1, 9, 23))).toEqual("2026-01-09");
  });
});

/**
 * The log carries more than plays now. A line written before other events existed has no
 * `type` at all, so reading has to treat its absence as a play — that is the whole history in
 * `plays.jsonl` and it must not be mistaken for something else.
 */
describe("typed events", () => {
  it("reads a line with no type as a play, as every older line is", () => {
    expect(parseEntry(line({at: 1000, id: "abc"})).type).toEqual("play");
    expect(parseEntry(line({at: 1000, id: "abc"})).subject).toEqual("track");
  });

  it("reads a skip", () => {
    const entry = parseEntry(line({at: 1000, id: "abc", type: "skip"}));
    expect(entry.type).toEqual("skip");
    expect(entry.count).toEqual(1);
  });

  it("reads a favourite on an album", () => {
    const entry = parseEntry(line({at: 1, id: "al", type: "favorite", subject: "album"}));
    expect(entry.type).toEqual("favorite");
    expect(entry.subject).toEqual("album");
  });

  it("reads a reaction, with whose it was and what it became", () => {
    const entry = parseEntry(line({at: 1, id: "a", type: "react", who: "chloe", value: "like"}));
    expect(entry.who).toEqual("chloe");
    expect(entry.value).toEqual("like");
  });

  it("falls back to a track for an unknown subject", () => {
    expect(parseEntry(line({at: 1, id: "a", subject: "nonsense"})).subject).toEqual("track");
  });
});

describe("filtering by type", () => {
  const mixed = [
    {at: 1, count: 1, estimated: false, id: "a", source: "desktop", subject: "track", type: "play"},
    {at: 2, count: 1, estimated: false, id: "b", source: "desktop", subject: "track", type: "skip"},
    {at: 3, count: 1, estimated: false, id: "c", source: "desktop", subject: "album",
      type: "favorite"},
    {at: 4, count: 1, estimated: false, id: "a", source: "phone", subject: "track", type: "play"},
  ];

  /** A skip or a favourite is not listening; counting them would inflate every chart. */
  it("keeps only the plays for the listening charts", () => {
    expect(onlyPlays(mixed).map((entry) => entry.id)).toEqual(["a", "a"]);
  });

  it("picks out one type", () => {
    expect(ofType(mixed, "skip").map((entry) => entry.id)).toEqual(["b"]);
    expect(ofType(mixed, "favorite").map((entry) => entry.id)).toEqual(["c"]);
    expect(ofType(mixed, "unfavorite")).toEqual([]);
  });

  it("does not let a skip count toward plays by day", () => {
    expect(playsByDay(onlyPlays(mixed))[dayOf(1)]).toEqual(2);
  });
});
