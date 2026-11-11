const fs = require("fs");
const os = require("os");
const path = require("path");
const {isShared, removeAlbumArt, removeArtistArt} = require("./artRemoval");

/**
 * Removing a picture is the only destructive thing the app does to `data/`, so what it deletes
 * and what it leaves alone are both worth pinning.
 */

function tempFile(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mymusic-art-"));
  const file = path.join(dir, name);
  fs.writeFileSync(file, "not really an image");
  return file;
}

function state(albums, artists) {
  return {library: {albums, artists}};
}

test("clears the cover, its marker and sets the error", () => {
  const file = tempFile("cover.png");
  const album = {albumArtFile: file, coverArt: {maxPx: 500, target: 1200}, errors: [], id: "al1"};
  const info = removeAlbumArt(state({al1: album}, {}), album);
  expect(info.albumArtFile).toBeUndefined();
  // the marker describes art that no longer exists
  expect(info.coverArt).toBeUndefined();
  expect(info.errors).toStrictEqual(["No album art found."]);
  expect(fs.existsSync(file)).toBe(false);
});

test("clears an artist picture the same way", () => {
  const file = tempFile("pic.png");
  const artist = {artFile: file, errors: ["No match found."], id: "ar1"};
  const info = removeArtistArt(state({}, {ar1: artist}), artist);
  expect(info.artFile).toBeUndefined();
  expect(info.errors).toStrictEqual(["No match found.", "No picture found."]);
  expect(fs.existsSync(file)).toBe(false);
});

test("leaves a file another entity still points at", () => {
  const file = tempFile("shared.png");
  const album = {albumArtFile: file, errors: [], id: "al1"};
  const other = {albumArtFile: file, errors: [], id: "al2"};
  removeAlbumArt(state({al1: album, al2: other}, {}), album);
  expect(fs.existsSync(file)).toBe(true);
});

test("an artist pointing at the same file also protects it", () => {
  const file = tempFile("both.png");
  const album = {albumArtFile: file, errors: [], id: "al1"};
  const artist = {artFile: file, errors: [], id: "ar1"};
  removeAlbumArt(state({al1: album}, {ar1: artist}), album);
  expect(fs.existsSync(file)).toBe(true);
});

test("does not count the entity itself as another reference", () => {
  const album = {albumArtFile: "/data/x.png", errors: [], id: "al1"};
  expect(isShared(state({al1: album}, {}), "/data/x.png", "al1")).toBe(false);
});

/** A file that will not unlink becomes another orphan rather than a failed operation. */
test("still clears the reference when the file is already gone", () => {
  const album = {albumArtFile: "/nowhere/missing.png", errors: [], id: "al1"};
  const info = removeAlbumArt(state({al1: album}, {}), album);
  expect(info.albumArtFile).toBeUndefined();
  expect(info.errors).toStrictEqual(["No album art found."]);
});

test("an entity with no picture is a no-op beyond the error", () => {
  const artist = {errors: [], id: "ar1"};
  expect(removeArtistArt(state({}, {ar1: artist}), artist).errors)
    .toStrictEqual(["No picture found."]);
});
