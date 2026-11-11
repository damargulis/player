import {matchesSearch} from "./utils";

/**
 * One rule for every search box. The album, artist and track lists each had their own copy and
 * the album one had drifted: it compared raw strings, so searching the album list for
 * "abbey road" found nothing while the same query worked in the other two.
 */
describe("matchesSearch", () => {
  it("ignores case, which the album list did not", () => {
    expect(matchesSearch("Abbey Road", "abbey road")).toEqual(true);
    expect(matchesSearch("abbey road", "ABBEY ROAD")).toEqual(true);
    expect(matchesSearch("Abbey Road", "ROAD")).toEqual(true);
  });

  it("matches anywhere in the name, not just the start", () => {
    expect(matchesSearch("The Dark Side of the Moon", "side of")).toEqual(true);
  });

  /**
   * Accents too: "bjork" finding nothing for Björk is the same complaint as a case mismatch,
   * and 14 artists and 15 albums here carry a non-ASCII letter.
   */
  it("ignores accents", () => {
    expect(matchesSearch("Björk", "bjork")).toEqual(true);
    expect(matchesSearch("Sigur Rós", "sigur ros")).toEqual(true);
    expect(matchesSearch("Beyoncé", "beyonce")).toEqual(true);
    expect(matchesSearch("Déjà Vu", "deja vu")).toEqual(true);
    // and the other direction, for someone who types the accent
    expect(matchesSearch("Bjork", "björk")).toEqual(true);
  });

  it("still says no to a name that does not contain the query", () => {
    expect(matchesSearch("Abbey Road", "revolver")).toEqual(false);
    expect(matchesSearch("Björk", "bjorn")).toEqual(false);
  });

  /** An empty box shows everything rather than nothing. */
  it("matches everything when there is no query", () => {
    expect(matchesSearch("Abbey Road", "")).toEqual(true);
    expect(matchesSearch("Abbey Road", undefined)).toEqual(true);
  });

  it("does not throw on a missing name", () => {
    expect(matchesSearch(undefined, "abbey")).toEqual(false);
    expect(matchesSearch("", "abbey")).toEqual(false);
  });
});
