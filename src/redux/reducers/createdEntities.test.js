import fs from "fs";
import path from "path";
import os from "os";
import {updateArtist, updateTrack} from "../actions";
import {loadLibrary} from "../../library/main";
import {planWarningAcceptance} from "../../trackWarnings";
import reducer from "./library";
import {getArtistsByIds} from "../selectors";

function library() {
  const track = (id, name) => ({
    albumIds: ["opm"], artistIds: ["streets"], dateAdded: new Date(0), duration: 1, errors: [],
    favorites: [], filePath: `/m/${id}.mp3`, genreIds: [], id, name, playCount: 0, playDate: new Date(0),
    skipCount: 0, year: 2002,
  });
  return {
    albums: {opm: {albumArtFile: "x", artistIds: ["streets"], errors: [], genreIds: [], id: "opm",
      name: "Original Pirate Material", trackIds: ["t1", "t2"], year: 2002}},
    artists: {streets: {albumIds: ["opm"], artFile: "x", errors: [], genreIds: [], id: "streets",
      name: "The Streets", trackIds: ["t1", "t2"]}},
    genres: {}, newTracks: [], playlists: {},
    tracks: {t1: track("t1", "Let's Push Things Forward"), t2: track("t2", "Same Old Thing")},
  };
}

/**
 * Accepting a featured artist from a track hint ("Kevin Mark Trail" on Original Pirate Material)
 * created the artist with no id: its tracks were dropped by the next membership sync, its page
 * broke, and the next load re-keyed it to "undefined", leaving both tracks crediting an artist
 * that did not exist — which then crashed the album and artist pages.
 */
describe("an artist created from a track hint", () => {
  function accept() {
    let state = library();
    const plan = planWarningAcceptance(["t1", "t2"], [{featuring: ["Kevin Mark Trail"]}, {featuring: ["Kevin Mark Trail"]}],
      (id) => state.tracks[id], () => undefined, () => "kmt");
    plan.newArtists.forEach((artist) => {
      state = reducer(state, updateArtist(artist.id, {albumIds: [], errors: [], genreIds: [], name: artist.name,
        trackIds: artist.trackIds}));
    });
    plan.trackUpdates.forEach(({id, info}) => {
      state = reducer(state, updateTrack(id, info));
    });
    return state;
  }

  it("carries its id and keeps both tracks", () => {
    const state = accept();
    expect(state.artists.kmt.id).toBe("kmt");
    expect(state.artists.kmt.trackIds).toEqual(["t1", "t2"]);
    expect(state.tracks.t1.artistIds).toEqual(["streets", "kmt"]);
  });

  it("survives a save and a reload under the same id", async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "created-")), "library.json");
    fs.writeFileSync(file, JSON.stringify(accept()));
    const loaded = await loadLibrary(file);
    expect(loaded.artists.kmt && loaded.artists.kmt.name).toBe("Kevin Mark Trail");
    expect(loaded.artists.undefined).toBeUndefined();
  });

  it("is healed on load if it was saved without its id, as the broken version did", async () => {
    const saved = accept();
    delete saved.artists.kmt.id;
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "created-")), "library.json");
    fs.writeFileSync(file, JSON.stringify(saved));
    const loaded = await loadLibrary(file);
    expect(loaded.artists.kmt.id).toBe("kmt");
  });
});

describe("a dangling artist id", () => {
  it("is skipped by lookups instead of becoming undefined in every list", () => {
    const state = {library: library()};
    expect(getArtistsByIds(state, ["streets", "gone"]).map((a) => a.name)).toEqual(["The Streets"]);
  });
});

describe("an update for a track the library does not have", () => {
  it("is ignored rather than creating a stray track", () => {
    const state = reducer(library(), updateTrack("deleted", {skipCount: 1}));
    expect(state.tracks.deleted).toBeUndefined();
  });
});
