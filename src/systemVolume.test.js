const {clampVolume} = require("../public/systemVolume");

/**
 * The level arrives from an unauthenticated LAN socket, so clamping is the security boundary,
 * not just input tidying. It is also passed to execFile as an argument rather than through a
 * shell, so these two together are what make a hostile value harmless.
 */
describe("clampVolume", () => {
  it("passes through a normal level", () => {
    expect(clampVolume(50)).toEqual(50);
    expect(clampVolume("73")).toEqual(73);
  });

  it("clamps to the 0-100 range", () => {
    expect(clampVolume(-20)).toEqual(0);
    expect(clampVolume(1000)).toEqual(100);
  });

  it("rounds fractional levels, since AppleScript wants an integer", () => {
    expect(clampVolume(42.7)).toEqual(43);
    expect(clampVolume(0.4)).toEqual(0);
  });

  // Number(null), Number(""), Number([]) and Number(true) are all numbers, so a type check
  // has to come before the coercion or null quietly becomes 0 - i.e. mute.
  it("rejects anything that is not a number", () => {
    expect(clampVolume(undefined)).toBeNull();
    expect(clampVolume(null)).toBeNull();
    expect(clampVolume("")).toBeNull();
    expect(clampVolume([])).toBeNull();
    expect(clampVolume(true)).toBeNull();
    expect(clampVolume("loud")).toBeNull();
    expect(clampVolume({})).toBeNull();
    expect(clampVolume(NaN)).toBeNull();
    expect(clampVolume(Infinity)).toBeNull();
  });

  // The shape that matters: a shell payload must never survive as a usable value.
  it("rejects a command-injection attempt rather than passing it on", () => {
    expect(clampVolume("50; rm -rf ~")).toBeNull();
    expect(clampVolume("$(whoami)")).toBeNull();
    expect(clampVolume("`id`")).toBeNull();
    expect(clampVolume('50 && osascript -e "do shell script \\"x\\""')).toBeNull();
  });

  it("never returns anything but a safe integer", () => {
    ["7", 7, 7.2, -5, 150].forEach((input) => {
      const out = clampVolume(input);
      expect(Number.isInteger(out)).toBe(true);
      expect(out).toBeGreaterThanOrEqual(0);
      expect(out).toBeLessThanOrEqual(100);
    });
  });
});
