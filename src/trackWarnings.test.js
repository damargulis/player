import {planWarningAcceptance} from "./trackWarnings";

const tracks = {
  t1: {id: "t1", name: "Song A", artistIds: ["realA"]},
  t2: {id: "t2", name: "Song B", artistIds: ["realB"]},
  t3: {id: "t3", name: "Song C", artistIds: ["realC"]},
};
const artists = {Known: {id: "known", name: "Known"}};
let next = 0;
const plan = (warnings) => planWarningAcceptance(["t1", "t2", "t3"], warnings, (id) => tracks[id],
  (name) => artists[name], () => `new${next++}`);

/**
 * Accepting used to set every hinted track's artists to the album's — on a compilation that put
 * "Various Artists" in place of each track's real artist, even for a hint only about the title.
 */
describe("planWarningAcceptance", () => {
  beforeEach(() => {
    next = 0;
  });

  it("leaves a track's own artists alone for a title-only hint", () => {
    const {trackUpdates} = plan([{name: "Song A (Remastered)"}, {}, {}]);
    expect(trackUpdates).toEqual([{id: "t1", info: {name: "Song A (Remastered)", warning: undefined}}]);
  });

  it("adds featured artists to the track's own, never the album's", () => {
    const {trackUpdates} = plan([{}, {featuring: ["Known"]}, {}]);
    expect(trackUpdates[0].info.artistIds).toEqual(["realB", "known"]);
  });

  it("creates a new featured artist once and credits every track that names them", () => {
    const {newArtists, trackUpdates} = plan([{featuring: ["Guest"]}, {}, {featuring: ["Guest"]}]);
    expect(newArtists).toEqual([{id: "new0", name: "Guest", trackIds: ["t1", "t3"]}]);
    expect(trackUpdates.map((u) => u.info.artistIds)).toEqual([["realA", "new0"], ["realC", "new0"]]);
  });

  it("does not copy the hint's featuring list onto the track", () => {
    const {trackUpdates} = plan([{featuring: ["Known"], name: "X"}, {}, {}]);
    expect(Object.keys(trackUpdates[0].info).sort()).toEqual(["artistIds", "name", "warning"]);
  });
});
