import {startRun, runDelta} from "../delta";
import {lookupRecording} from "./api";
import {applyRecording} from "./tracks";

const store = () => ({library: {genres: {g1: {id: "g1", name: "Rock"}}}});

/**
 * A track's year is its recording's first release, not the album it was ripped from: a song on a
 * 1990s compilation keeps the year it first came out.
 */
describe("applyRecording", () => {
  it("takes the recording's genres and first-release year", () => {
    const state = store();
    const track = {id: "t1", genreIds: ["g1"], year: 1999};
    expect(applyRecording(state, track, {"first-release-date": "1971-11-08", "genres": [
      {count: 5, name: "hard rock"}, {count: 2, name: "rock"},
    ], "id": "r1"})).toBe(true);
    expect(track.year).toBe(1971);
    expect(track.genreIds.map((id) => state.library.genres[id].name.toLowerCase())).toEqual(["hard rock", "rock"]);
  });

  it("changes nothing a recording does not supply", () => {
    const track = {id: "t1", genreIds: ["g1"], year: 1999};
    expect(applyRecording(store(), track, {"first-release-date": "", "genres": [], "id": "r1"})).toBe(false);
    expect(track).toEqual({id: "t1", genreIds: ["g1"], year: 1999});
  });
});

describe("the recording id", () => {
  it("is part of what a run sends back, so a match made by the album run is kept", () => {
    const track = {id: "t1", genreIds: [], year: 0};
    const start = startRun([], [], [track], {});
    track.mbid = "f6dc0978-4e35-41c5-a653-f8b78765da51";
    expect(runDelta(start, [], [], [track], {}).tracks).toEqual({t1: {mbid: "f6dc0978-4e35-41c5-a653-f8b78765da51"}});
  });

  it("is looked up directly, with its genres", async () => {
    const realFetch = window.fetch;
    let asked;
    window.fetch = global.fetch = (url) => {
      asked = url;
      return Promise.resolve(new Response(JSON.stringify({"first-release-date": "1971", "id": "r1"}), {status: 200}));
    };
    try {
      const recording = await lookupRecording("r1");
      expect(asked).toMatch(/\/recording\/r1\?inc=genres&fmt=json$/);
      expect(recording["first-release-date"]).toBe("1971");
    } finally {
      window.fetch = global.fetch = realFetch;
    }
  });
});
