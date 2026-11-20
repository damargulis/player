import {runDelta, startRun} from "./delta";

/** The reducer's rule: an update is spread over the live entity. */
const merge = (live, delta) => Object.fromEntries(Object.entries(live)
  .map(([id, entity]) => [id, {...entity, ...(delta[id] || {})}]));

/**
 * MusicBrainz and Wikipedia sent back whole objects — every track, playlist and genre — as they
 * were when the run started, so a run of several hours rolled back everything done meanwhile.
 */
describe("runDelta", () => {
  function setUp() {
    const track = {id: "t1", name: "Song", playCount: 5, genreIds: ["g1"], warning: {name: "Old"}};
    const album = {id: "a1", name: "Album", trackIds: ["t1"], errors: ["No genres found."], skipCount: 0, year: 1990};
    const genres = {g1: {id: "g1", name: "Rock"}};
    return {album, genres, start: startRun([album], [], [track], genres), track};
  }

  it("carries only what the run changed, so a play made mid-run survives", () => {
    const {album, genres, start, track} = setUp();
    // the run mutates its snapshot in place, nested objects included
    track.genreIds = ["g1", "g2"];
    track.warning.name = "New";
    album.errors.push("Wrong number of tracks found.");
    genres.g2 = {id: "g2", name: "Indie"};
    const delta = runDelta(start, [album], [], [track], genres);
    expect(delta.tracks).toEqual({t1: {genreIds: ["g1", "g2"], warning: {name: "New"}}});
    expect(delta.albums).toEqual({a1: {errors: ["No genres found.", "Wrong number of tracks found."]}});
    expect(delta.genres).toEqual({g2: {id: "g2", name: "Indie"}});
    expect(delta.playlists).toBeUndefined();

    // meanwhile the song was played twice and the album skipped
    const live = {t1: {...track, genreIds: ["g1"], playCount: 7, warning: {name: "Old"}}};
    expect(merge(live, delta.tracks).t1.playCount).toBe(7);
    expect(merge({a1: {...album, skipCount: 3}}, delta.albums).a1.skipCount).toBe(3);
  });

  it("sends a field that became unset, so a cleared hint is cleared", () => {
    const {genres, start, track} = setUp();
    track.warning = undefined;
    const delta = runDelta(start, [], [], [track], genres);
    expect(Object.keys(delta.tracks.t1)).toEqual(["warning"]);
    expect(delta.tracks.t1.warning).toBeUndefined();
  });

  it("sends nothing for an entity the run left alone", () => {
    const {album, genres, start, track} = setUp();
    expect(runDelta(start, [album], [], [track], genres)).toEqual({albums: {}, artists: {}, genres: {}, tracks: {}});
  });
});
