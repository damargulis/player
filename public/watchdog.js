/**
 * Notices when the renderer stops responding, from the one process that still can.
 *
 * On 2026-11-11 the app froze mid-album with no crash and no message. The renderer's
 * AudioOutputDevice thread was spinning at 99% while the main thread sat in
 * `__psynch_mutexwait`, blocked on the lock that thread held — so the UI, playback and every
 * IPC reply were gone at once. It had been wedged fourteen minutes before anyone noticed, and
 * the only symptom was silence. Changing the output device did not help, because the thread
 * that would have processed the change was the blocked one.
 *
 * The important consequence: **nothing in the renderer can detect this**, because the thread a
 * check would run on is the thread that is stuck. The main process stayed at 0% CPU throughout,
 * answering HTTP and holding the menu bar, so that is where this lives.
 *
 * It asks rather than infers. `controller-state` already arrives on every `timeupdate` and
 * would make a free heartbeat, but `timeupdate` does not fire while paused, so silence from it
 * means either "wedged" or "paused" and there is no telling which. An unanswered ping has only
 * one meaning: the renderer's JS thread is not running tasks.
 */

const PING_EVERY_MS = 10000;
/**
 * How many unanswered pings before saying so.
 *
 * Three is ~30s. A single miss is not worth reporting — a long synchronous task on the renderer
 * will swallow one, and this app has several: the library reducer writes 13MB on every mutating
 * action, and an extension sweep commits in batches.
 */
const MISSES_BEFORE_ALARM = 3;

let timer = null;
let awaiting = 0;
let alarmed = false;
let onWedged = null;

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  awaiting = 0;
  alarmed = false;
}

/** Called when the renderer answers, which is also how it recovers from an alarm. */
function pong() {
  awaiting = 0;
  alarmed = false;
}

function tick(getWebContents) {
  const contents = getWebContents();
  if (!contents || contents.isDestroyed()) {
    return;
  }
  if (awaiting >= MISSES_BEFORE_ALARM) {
    // Latched: report once and stay quiet until it answers again, so a hang does not turn into
    // a dialog every ten seconds on top of a frozen window.
    if (!alarmed) {
      alarmed = true;
      if (onWedged) {
        onWedged(awaiting * (PING_EVERY_MS / 1000));
      }
    }
    return;
  }
  awaiting += 1;
  // A send that lands in a blocked renderer's task queue is harmless; it runs late or never.
  contents.send("watchdog-ping");
}

/**
 * `getWebContents` is a function rather than the object, because the window is replaced on
 * reload and a captured handle would be watching a renderer that no longer exists.
 */
function start(getWebContents, handler) {
  stop();
  onWedged = handler;
  timer = setInterval(() => tick(getWebContents), PING_EVERY_MS);
}

module.exports = {
  MISSES_BEFORE_ALARM,
  PING_EVERY_MS,
  // The two underscore-prefixed exports are for the tests: the interval is the only caller in
  // the app, and waiting 30 real seconds per case to watch a hang detector is not a test
  // anyone would run.
  __setHandler: (handler) => {
    onWedged = handler;
    awaiting = 0;
    alarmed = false;
  },
  __tick: tick,
  pong,
  start,
  stop,
};
