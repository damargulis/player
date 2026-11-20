import {externalEffectsAllowed} from "./devSafety";

const main = require("../public/devSafety");

/**
 * A development copy uploaded its library to the real backup bucket, refreshed concerts on the
 * shared JamBase budget and advertised itself to the phone. Off in development unless asked for.
 */
describe("external effects", () => {
  it("are always on in the installed app", () => {
    expect(externalEffectsAllowed("backup", {}, false)).toBe(true);
    expect(main.externalEffectsAllowed("bonjour", false, {})).toBe(true);
  });

  it("are off in development by default", () => {
    expect(externalEffectsAllowed("backup", {}, true)).toBe(false);
    expect(externalEffectsAllowed("concerts", {}, true)).toBe(false);
    expect(main.externalEffectsAllowed("bonjour", true, {})).toBe(false);
    expect(main.externalEffectsAllowed("shortcuts", true, {})).toBe(false);
  });

  it("can be switched on one at a time, or all at once", () => {
    const env = {MYMUSIC_DEV_EFFECTS: "concerts, bonjour"};
    expect(externalEffectsAllowed("concerts", env, true)).toBe(true);
    expect(externalEffectsAllowed("backup", env, true)).toBe(false);
    expect(main.externalEffectsAllowed("bonjour", true, env)).toBe(true);
    expect(main.externalEffectsAllowed("shortcuts", true, env)).toBe(false);
    expect(externalEffectsAllowed("backup", {MYMUSIC_DEV_EFFECTS: "all"}, true)).toBe(true);
  });

  it("are off under test, where nothing should reach a real service", () => {
    expect(externalEffectsAllowed("backup", {})).toBe(false);
  });
});
