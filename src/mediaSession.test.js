import {artworkDataUrl, MAX_ART_BYTES} from "./mediaSession";
import {DATA_DIR} from "./constants";
import fs from "fs";
import path from "path";

const dir = path.join(DATA_DIR, "art-fixture");
// a 1x1 png, so this is real image bytes rather than a renamed text file
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64");

beforeEach(() => {
  fs.mkdirSync(dir, {recursive: true});
});

describe("artworkDataUrl", () => {
  it("embeds a png as a data url", () => {
    const file = path.join(dir, "cover.png");
    fs.writeFileSync(file, PNG);
    const url = artworkDataUrl(file);
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
    expect(url.slice("data:image/png;base64,".length)).toEqual(PNG.toString("base64"));
  });

  it("returns nothing when there is no art", () => {
    expect(artworkDataUrl(undefined)).toBeUndefined();
    expect(artworkDataUrl("")).toBeUndefined();
  });

  it("returns nothing for a missing file rather than throwing mid track change", () => {
    expect(artworkDataUrl(path.join(dir, "gone.png"))).toBeUndefined();
  });

  it("returns nothing for a directory", () => {
    expect(artworkDataUrl(dir)).toBeUndefined();
  });

  // The library has at least one 50MB png. Inlining that on every track change would stall
  // playback for a thumbnail nobody can see properly.
  it("skips art above the size cap", () => {
    const file = path.join(dir, "huge.png");
    fs.writeFileSync(file, Buffer.alloc(MAX_ART_BYTES + 1));
    expect(artworkDataUrl(file)).toBeUndefined();
  });

  it("keeps art just under the cap", () => {
    const file = path.join(dir, "big.png");
    fs.writeFileSync(file, Buffer.alloc(MAX_ART_BYTES - 1));
    expect(artworkDataUrl(file)).toBeDefined();
  });

  it("refuses a type it cannot label, since the mime type must be right", () => {
    const file = path.join(dir, "cover.txt");
    fs.writeFileSync(file, "not an image");
    expect(artworkDataUrl(file)).toBeUndefined();
  });

  it("labels jpegs correctly", () => {
    const file = path.join(dir, "cover.jpg");
    fs.writeFileSync(file, PNG);
    expect(artworkDataUrl(file).startsWith("data:image/jpeg;base64,")).toBe(true);
  });

  it("is case-insensitive about the extension", () => {
    const file = path.join(dir, "COVER.PNG");
    fs.writeFileSync(file, PNG);
    expect(artworkDataUrl(file).startsWith("data:image/png;base64,")).toBe(true);
  });
});
