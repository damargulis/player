const watchdog = require("./watchdog");

/**
 * The watchdog only matters on the day the renderer deadlocks, which is exactly when nothing
 * can be checked by hand. These drive it with a fake webContents rather than a real one.
 */

function fakeContents() {
  const sent = [];
  return {
    isDestroyed: () => false,
    send: (channel) => sent.push(channel),
    sent,
  };
}

function runTicks(contents, count) {
  // tick() is not exported; drive it the way the interval does, by advancing real timers is
  // too slow, so reach through module internals the same way start() does.
  for (let i = 0; i < count; i++) {
    watchdog.__tick(() => contents);
  }
}

afterEach(() => watchdog.stop());

test("pings the renderer", () => {
  const contents = fakeContents();
  runTicks(contents, 1);
  expect(contents.sent).toEqual(["watchdog-ping"]);
});

test("says nothing while the renderer answers", () => {
  const contents = fakeContents();
  let alarms = 0;
  watchdog.__setHandler(() => alarms++);
  for (let i = 0; i < 10; i++) {
    runTicks(contents, 1);
    watchdog.pong();
  }
  expect(alarms).toBe(0);
});

/** One miss is a long synchronous task — this app writes 13MB on every mutating action. */
test("tolerates a missed ping", () => {
  const contents = fakeContents();
  let alarms = 0;
  watchdog.__setHandler(() => alarms++);
  runTicks(contents, watchdog.MISSES_BEFORE_ALARM);
  expect(alarms).toBe(0);
});

test("reports once the misses pile up", () => {
  const contents = fakeContents();
  const seen = [];
  watchdog.__setHandler((seconds) => seen.push(seconds));
  runTicks(contents, watchdog.MISSES_BEFORE_ALARM + 1);
  expect(seen).toHaveLength(1);
  expect(seen[0]).toBeGreaterThan(0);
});

/** Latched: a frozen window must not also collect a dialog every ten seconds. */
test("reports only once while it stays wedged", () => {
  const contents = fakeContents();
  let alarms = 0;
  watchdog.__setHandler(() => alarms++);
  runTicks(contents, watchdog.MISSES_BEFORE_ALARM + 8);
  expect(alarms).toBe(1);
});

test("re-arms once the renderer answers again", () => {
  const contents = fakeContents();
  let alarms = 0;
  watchdog.__setHandler(() => alarms++);
  runTicks(contents, watchdog.MISSES_BEFORE_ALARM + 1);
  expect(alarms).toBe(1);
  watchdog.pong();
  runTicks(contents, watchdog.MISSES_BEFORE_ALARM + 1);
  expect(alarms).toBe(2);
});

test("does nothing when the window has gone", () => {
  const gone = {isDestroyed: () => true, send: () => { throw new Error("must not send"); }};
  let alarms = 0;
  watchdog.__setHandler(() => alarms++);
  for (let i = 0; i < 10; i++) {
    watchdog.__tick(() => gone);
  }
  expect(alarms).toBe(0);
});
