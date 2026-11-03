const { execFile } = require("child_process");

// --- macOS system volume, so the phone can turn the laptop itself up and down.
//
// osascript rather than a native module: it needs no dependency and no permission prompt
// ("set volume" runs inside osascript rather than scripting another app). The cost is ~150ms
// per call, which is why a slider drag is coalesced rather than applied per event.
//
// execFile, never exec: the level arrives from an unauthenticated LAN socket, so it is clamped
// to an integer and passed as an argument, never interpolated into a shell string.
const SYSTEM_VOLUME_INTERVAL = 200;
let systemVolume = { volume: null, muted: false };
let pendingVolume = null;
let volumeTimer = null;

function clampVolume(value) {
  // Types are checked before coercing: Number(null), Number(""), Number([]) and Number(true)
  // all produce a number, so a phone sending null would otherwise silently mute the laptop.
  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }
  const level = Math.round(Number(value));
  if (!Number.isFinite(level)) {
    return null;
  }
  return Math.max(0, Math.min(100, level));
}

function runOsascript(script) {
  return new Promise((resolve) => {
    execFile("osascript", ["-e", script], { timeout: 4000 }, (err, stdout) => {
      resolve(err ? null : String(stdout).trim());
    });
  });
}

function readSystemVolume() {
  return runOsascript(
    "set v to get volume settings\nreturn (output volume of v as text) & \",\" & (output muted of v as text)",
  ).then((out) => {
    if (!out) {
      return systemVolume;
    }
    const [level, muted] = out.split(",");
    const parsed = clampVolume(level);
    if (parsed !== null) {
      systemVolume = { volume: parsed, muted: muted === "true" };
    }
    return systemVolume;
  });
}

/** Applies the latest requested level, at most once per interval - a drag emits far more. */
function flushVolume() {
  volumeTimer = null;
  if (pendingVolume === null) {
    return;
  }
  const level = pendingVolume;
  pendingVolume = null;
  systemVolume = { volume: level, muted: level === 0 ? systemVolume.muted : false };
  runOsascript(`set volume output volume ${level}`).then(() => {
    if (pendingVolume !== null && volumeTimer === null) {
      volumeTimer = setTimeout(flushVolume, SYSTEM_VOLUME_INTERVAL);
    }
  });
}

function setSystemVolume(value) {
  const level = clampVolume(value);
  if (level === null) {
    return;
  }
  pendingVolume = level;
  if (volumeTimer === null) {
    volumeTimer = setTimeout(flushVolume, SYSTEM_VOLUME_INTERVAL);
  }
}

function setSystemMuted(muted) {
  const next = Boolean(muted);
  systemVolume = Object.assign({}, systemVolume, { muted: next });
  runOsascript(`set volume output muted ${next}`);
}

module.exports = {
  clampVolume,
  current: () => systemVolume,
  hasPending: () => pendingVolume !== null,
  readSystemVolume,
  setSystemMuted,
  setSystemVolume,
};
