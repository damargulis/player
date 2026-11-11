import {describeLength, MOSAIC_TILES, summarise} from "./playlistSummary";

/**
 * The picker shows these numbers for every playlist on screen, and the biggest one here is
 * 3,106 tracks, so the things worth pinning are what it says about a playlist and that it does
 * not fall over on a library that is missing pieces.
 */

function track(id, name, albumIds, artistIds, duration) {
  return {albumIds, artistIds, duration, id, name};
}

function state() {
  return {
    library: {
      albums: {
        a1: {albumArtFile: "art1.png", id: "a1", name: "One"},
        a2: {albumArtFile: "art2.png", id: "a2", name: "Two"},
        a3: {albumArtFile: "art3.png", id: "a3", name: "Three"},
        a4: {albumArtFile: "art4.png", id: "a4", name: "Four"},
        a5: {id: "a5", name: "No cover"},
      },
      artists: {
        r1: {id: "r1", name: "Alpha"},
        r2: {id: "r2", name: "Beta"},
        r3: {id: "r3", name: "Gamma"},
        r4: {id: "r4", name: "Delta"},
      },
      tracks: {
        t1: track("t1", "One", ["a1"], ["r1"], 60000),
        t2: track("t2", "Two", ["a1"], ["r1"], 60000),
        t3: track("t3", "Three", ["a2"], ["r2"], 120000),
        t4: track("t4", "Four", ["a3"], ["r3"], 30000),
        t5: track("t5", "Five", ["a4"], ["r4"], 30000),
        t6: track("t6", "Six", ["a5"], ["r4"], 30000),
      },
    },
  };
}

test("counts the tracks and adds up the runtime", () => {
  const summary = summarise(state(), {name: "All", trackIds: ["t1", "t2", "t3"]});
  expect(summary.trackCount).toBe(3);
  expect(summary.durationMs).toBe(240000);
  expect(describeLength(summary)).toBe("3 tracks · 4m");
});

test("names the most frequent artists first", () => {
  const summary = summarise(state(), {name: "All", trackIds: ["t1", "t2", "t3", "t4"]});
  // Alpha has two of the four, so it leads whatever order the tracks are in
  expect(summary.topArtists[0]).toBe("Alpha");
  expect(summary.topArtists).toHaveLength(3);
});

test("collects covers for a mosaic, most represented album first", () => {
  const playlist = {name: "All", trackIds: ["t1", "t2", "t3", "t4", "t5"]};
  const summary = summarise(state(), playlist);
  expect(summary.artFiles).toHaveLength(MOSAIC_TILES);
  expect(summary.artFiles[0]).toBe("art1.png");
});

test("skips albums with no cover rather than leaving a hole in the mosaic", () => {
  const summary = summarise(state(), {name: "All", trackIds: ["t6", "t1", "t3"]});
  expect(summary.artFiles).toStrictEqual(["art1.png", "art2.png"]);
});

test("survives a playlist pointing at tracks that are gone", () => {
  // the auto playlists are derived, but a manual one imported from iTunes can outlive a track
  const summary = summarise(state(), {name: "Stale", trackIds: ["t1", "missing"]});
  expect(summary.trackCount).toBe(1);
  expect(describeLength(summary)).toBe("1 track · 1m");
});

test("an empty playlist says so instead of reading as a bug", () => {
  expect(describeLength(summarise(state(), {name: "Nothing", trackIds: []}))).toBe("empty");
  expect(describeLength(summarise(state(), {name: "Undefined ids"}))).toBe("empty");
});

test("reports hours once there are any", () => {
  const long = {durationMs: 45300000, trackCount: 185};
  expect(describeLength(long)).toBe("185 tracks · 12h 35m");
});

test("answers from the cache for the same playlist object", () => {
  const playlist = {name: "All", trackIds: ["t1", "t2"]};
  const first = summarise(state(), playlist);
  // a different state entirely: a second call must not have looked at it
  expect(summarise({library: {albums: {}, artists: {}, tracks: {}}}, playlist)).toBe(first);
});
