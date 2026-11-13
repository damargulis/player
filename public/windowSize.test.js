const windowSize = require("./windowSize");

/** A stand-in for the BrowserWindow: the two calls this module makes, and a record of them. */
function fakeWindow(width, height) {
  return {
    getSize: () => [width, height],
    setSize: (w, h) => {
      width = w;
      height = h;
    },
    size: () => [width, height],
  };
}

beforeEach(() => windowSize.reset());

test("the mini player is a fixed size", () => {
  const win = fakeWindow(1430, 800);
  windowSize.toMini(win);
  expect(win.size()).toEqual([windowSize.MINI.width, windowSize.MINI.height]);
});

/** The bug: a trip to the mini player and back reset the window to the shipped default. */
test("comes back at the size it was left at", () => {
  const win = fakeWindow(1800, 1100);
  windowSize.toMini(win);
  windowSize.toMax(win);
  expect(win.size()).toEqual([1800, 1100]);
});

test("remembers across several trips, including a resize while small", () => {
  const win = fakeWindow(900, 600);
  windowSize.toMini(win);
  windowSize.toMax(win);
  expect(win.size()).toEqual([900, 600]);
  win.setSize(1200, 700);
  windowSize.toMini(win);
  windowSize.toMax(win);
  expect(win.size()).toEqual([1200, 700]);
});

/**
 * The edge case worth pinning. The mini player's "jump to this track/album/artist" links
 * maximize too, and they fire whether or not the window is small — so restoring unconditionally
 * would snap it back to however big it was at the last trip, discarding a resize since.
 */
test("maximizing an already-full window leaves its size alone", () => {
  const win = fakeWindow(1430, 800);
  windowSize.toMini(win);
  windowSize.toMax(win);
  win.setSize(1000, 650);
  windowSize.toMax(win);
  expect(win.size()).toEqual([1000, 650]);
});

test("minimizing twice does not remember the mini size as the full one", () => {
  const win = fakeWindow(1500, 900);
  windowSize.toMini(win);
  windowSize.toMini(win);
  windowSize.toMax(win);
  expect(win.size()).toEqual([1500, 900]);
});

test("falls back to the default before the window has ever been small", () => {
  const win = fakeWindow(640, 480);
  // nothing remembered yet, and the window is not in mini mode, so this changes nothing
  windowSize.toMax(win);
  expect(win.size()).toEqual([640, 480]);
});

test("survives a missing window", () => {
  expect(() => windowSize.toMini(null)).not.toThrow();
  expect(() => windowSize.toMax(undefined)).not.toThrow();
});
