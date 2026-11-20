import {libraryMemo} from "./memo";

/**
 * Pages cached selectors with `memoize` over the root state, which is a new object on every action,
 * so the cache never hit and each page re-rendered four times a second during playback.
 */
describe("libraryMemo", () => {
  const library = {tracks: {a: {id: "a"}}};
  let calls;
  const select = (state, ids) => {
    calls++;
    return ids.map((id) => state.library.tracks[id]);
  };

  beforeEach(() => {
    calls = 0;
  });

  it("returns the same array across actions that leave the library alone", () => {
    const tracksOf = libraryMemo(select);
    const ids = ["a"];
    const first = tracksOf({currentlyPlaying: {time: 1}, library}, ids);
    const second = tracksOf({currentlyPlaying: {time: 2}, library}, ids);
    expect(second).toBe(first);
    expect(calls).toBe(1);
  });

  it("recomputes when the library or an argument changes", () => {
    const tracksOf = libraryMemo(select);
    const ids = ["a"];
    tracksOf({library}, ids);
    tracksOf({library: {...library}}, ids);
    tracksOf({library}, ["a"]);
    expect(calls).toBe(3);
  });

  it("keeps separate instances separate, so two mounted pages do not evict each other", () => {
    const pageOne = libraryMemo(select);
    const pageTwo = libraryMemo(select);
    const one = ["a"];
    const two = ["a"];
    pageOne({library}, one);
    pageTwo({library}, two);
    pageOne({library}, one);
    pageTwo({library}, two);
    expect(calls).toBe(2);
  });
});
