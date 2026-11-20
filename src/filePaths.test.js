const {fileUrlToPath} = require("../public/filePaths");

/**
 * decodeURI leaves reserved escapes encoded, so "%23" stayed "%23" instead of "#": the 54 tracks
 * with a "#" in their name (and one with ";") 404'd when the phone asked for them.
 */
describe("fileUrlToPath", () => {
  it("decodes reserved characters as well as spaces", () => {
    expect(fileUrlToPath("file:///Music/John%20Lennon/07%20%239%20Dream.mp3"))
      .toBe("/Music/John Lennon/07 #9 Dream.mp3");
    expect(fileUrlToPath("file:///Music/a%3Bb.mp3")).toBe("/Music/a;b.mp3");
  });

  it("returns an unencoded drag-and-drop path as it is rather than throwing on a literal %", () => {
    expect(fileUrlToPath("file:///Music/100% Hits/01 Song.mp3")).toBe("/Music/100% Hits/01 Song.mp3");
  });
});
