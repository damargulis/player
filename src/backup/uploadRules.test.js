const {alreadyExists, objectFor} = require("./uploadRules");

/**
 * Every 403 used to mean "already in the bucket", so a revoked grant or a disabled billing account
 * marked each file in a run as backed up without uploading it.
 */
describe("alreadyExists", () => {
  it("accepts the create-only precondition failing", () => {
    expect(alreadyExists(412, "")).toBe(true);
  });

  it("accepts the objectCreator key's overwrite refusal", () => {
    const body = JSON.stringify({error: {code: 403, message:
      "backup@x.iam.gserviceaccount.com does not have storage.objects.delete access to the object."}});
    expect(alreadyExists(403, body)).toBe(true);
  });

  it("treats every other 403 as the failure it is", () => {
    expect(alreadyExists(403, JSON.stringify({error: {message: "The billing account is disabled."}}))).toBe(false);
    expect(alreadyExists(403, JSON.stringify({error: {message: "does not have storage.objects.create access"}})))
      .toBe(false);
    expect(alreadyExists(403, "")).toBe(false);
    expect(alreadyExists(500, "storage.objects.delete")).toBe(false);
  });
});

describe("objectFor", () => {
  const name = "music/Music/Artist/01 Song.mp3";

  it("uses the mirror name for a first upload and for unchanged bytes", () => {
    expect(objectFor(name, 100, undefined)).toBe(name);
    expect(objectFor(name, 100, {size: 100})).toBe(name);
  });

  it("gives changed bytes a versioned sibling that keeps the extension", () => {
    expect(objectFor(name, 120, {size: 100})).toBe("music/Music/Artist/01 Song~120.mp3");
  });

  it("keeps pointing at the versioned object once it holds the current bytes", () => {
    expect(objectFor(name, 120, {object: "music/Music/Artist/01 Song~120.mp3", size: 120}))
      .toBe("music/Music/Artist/01 Song~120.mp3");
  });
});
