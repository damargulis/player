const fs = require("fs");
const path = require("path");

const SOURCE = path.join(__dirname, "../public/game-common.js");

/**
 * `public/game-common.js` is a plain script for the game windows, not a module — the pages load
 * over file:// with no build step, so it attaches a `Game` global instead of exporting. Loading
 * it here means stubbing the two things it reaches for.
 */
function loadGame() {
  const ipc = {on() {}, once() {}, send() {}};
  const sandbox = {window: {require: () => ({ipcRenderer: ipc})}, document: {}};
  // tslint:disable-next-line no-eval
  new Function("window", "document", fs.readFileSync(SOURCE, "utf8"))(sandbox.window, sandbox.document);
  return sandbox.window.Game;
}

/** Every top-level function in the file, i.e. everything the IIFE means to offer. */
function declaredFunctions() {
  const source = fs.readFileSync(SOURCE, "utf8");
  // two-space indent is top level inside the IIFE; anything deeper is a helper of its owner
  return (source.match(/^ {2}function (\w+)\(/gm) || [])
    .map((line) => line.replace(/^ {2}function (\w+)\($/, "$1"));
}

/**
 * The export list is hand-written and alphabetised, which makes an omission invisible: the
 * function is defined, the file parses, every page loads, and the call throws "is not a
 * function" only when a game actually runs. `loadTracks` was left out exactly that way, which
 * broke the library fetch on all six game pages at once while every other check passed.
 */
describe("the Game API surface", () => {
  it("exports every top-level function it defines", () => {
    const game = loadGame();
    const missing = declaredFunctions().filter((name) => game[name] === undefined);
    expect(missing).toEqual([]);
  });

  it("offers what the game pages actually call", () => {
    const game = loadGame();
    // the contract the pages are written against; losing any of these breaks a game silently
    const required = ["Filters", "Scores", "Timer", "artUrl", "artistMatches", "bonuses",
      "buildChoices", "djClue", "loadTracks", "lyrics", "matchCounter", "normalize", "parseList",
      "parseLrc", "renderInsights", "revealChoices", "screens", "shuffle"];
    expect(required.filter((name) => typeof game[name] !== "function")).toEqual([]);
  });
});

describe("normalize", () => {
  const game = loadGame();

  it("ignores case and punctuation", () => {
    expect(game.normalize("Don't Stop!")).toEqual(game.normalize("dont stop"));
  });

  it("treats a leading 'the' as optional", () => {
    expect(game.normalize("Beatles")).toEqual(game.normalize("The Beatles"));
  });

  it("keeps a title that is nothing but 'the'", () => {
    // The The would otherwise key as the empty string and match everything
    expect(game.normalize("The The")).toEqual("thethe");
  });

  /**
   * The strip drops every non-ASCII letter, so without folding first an accent eats the
   * character: Bjork vs Björk was a wrong answer for a correctly typed name, and 14 artists
   * and 15 albums in this library are affected.
   */
  it("folds accents so a plain-ASCII guess matches", () => {
    expect(game.normalize("Bjork")).toEqual(game.normalize("Björk"));
    expect(game.normalize("Sigur Ros")).toEqual(game.normalize("Sigur Rós"));
    expect(game.normalize("Beyonce")).toEqual(game.normalize("Beyoncé"));
    expect(game.normalize("Janelle Monae")).toEqual(game.normalize("Janelle Monáe"));
  });
});

describe("artistMatches", () => {
  const game = loadGame();

  it("accepts the whole credit", () => {
    expect(game.artistMatches(game.normalize("A, B"), "A, B")).toEqual(true);
  });

  it("accepts any one artist of a joined credit", () => {
    expect(game.artistMatches(game.normalize("Billy Preston"), "The Beatles, Billy Preston"))
      .toEqual(true);
  });

  it("rejects an artist who is not credited", () => {
    expect(game.artistMatches(game.normalize("Yoko Ono"), "The Beatles, Billy Preston"))
      .toEqual(false);
  });
});

describe("parseLrc", () => {
  const game = loadGame();

  it("reads timestamps in both the dot and colon forms", () => {
    expect(game.parseLrc("[00:12.50]one\n[01:05:3]two")).toEqual([
      {at: 12500, text: "one"},
      {at: 65300, text: "two"},
    ]);
  });

  it("drops metadata tags rather than offering them as lyrics", () => {
    expect(game.parseLrc("[ar:Nobody]\n[00:01.00]real")).toEqual([{at: 1000, text: "real"}]);
  });

  it("falls back to plain text when there are no timestamps", () => {
    expect(game.parseLrc("one\ntwo")).toEqual([{text: "one"}, {text: "two"}]);
  });
});

describe("bonuses", () => {
  const game = loadGame();

  it("pays more for a faster answer", () => {
    expect(game.bonuses(0.9, 1).speedBonus).toEqual(2);
    expect(game.bonuses(0.6, 1).speedBonus).toEqual(1);
    expect(game.bonuses(0.1, 1).speedBonus).toEqual(0);
  });

  it("caps the streak bonus and pays nothing for the first round of one", () => {
    expect(game.bonuses(0, 1).streakBonus).toEqual(0);
    expect(game.bonuses(0, 2).streakBonus).toEqual(1);
    expect(game.bonuses(0, 50).streakBonus).toEqual(2);
  });
});
