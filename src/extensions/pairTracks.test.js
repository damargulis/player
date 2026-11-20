import {pairTracks} from "./pairTracks";

const local = (names) => names.map((name, i) => ({id: `t${i}`, name}));
const titles = (paired) => paired.map((entry) => entry && entry.title);

/**
 * Pairing by position gave half of every multi-disc album the wrong song's genres, year and name
 * hint: the library sorts by track number alone, the sources list disc 1 then disc 2.
 */
describe("pairTracks", () => {
  it("pairs a multi-disc album by title despite the interleaved local order", () => {
    const release = ["A1", "A2", "B1", "B2"].map((title) => ({title}));
    const tracks = local(["A1", "B1", "A2", "B2"]);
    expect(titles(pairTracks(tracks, release, (e) => e.title))).toEqual(["A1", "B1", "A2", "B2"]);
  });

  it("folds case, accents and punctuation, and ignores a trailing qualifier", () => {
    const release = [{title: "Déjà Vu"}, {title: "Paint It, Black (Remastered 2011)"}];
    const tracks = local(["Paint It Black", "deja vu"]);
    expect(titles(pairTracks(tracks, release, (e) => e.title)))
      .toEqual(["Paint It, Black (Remastered 2011)", "Déjà Vu"]);
  });

  it("gives two songs with the same name one entry each", () => {
    const release = [{title: "Intro", n: 1}, {title: "Song"}, {title: "Intro", n: 2}];
    const paired = pairTracks(local(["Intro", "Song", "Intro"]), release, (e) => e.title);
    expect(paired.map((e) => e.n)).toEqual([1, undefined, 2]);
  });

  it("falls back to order for tracks whose titles match nothing", () => {
    const release = [{title: "One"}, {title: "Two (Interlude)"}, {title: "Three"}];
    const tracks = local(["One", "Track 02", "Three"]);
    expect(titles(pairTracks(tracks, release, (e) => e.title))).toEqual(["One", "Two (Interlude)", "Three"]);
  });
});
