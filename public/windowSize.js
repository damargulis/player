/**
 * Switching the main window between the full browser and the mini player, keeping the size.
 *
 * `maximize()` used to call `setSize(1430, 800)` outright, so a trip to the mini player and
 * back threw away whatever size the window had been given and reset it to the shipped default.
 *
 * The part that needs care is that coming back is not the only caller. The mini player's
 * "jump to this track/album/artist" links maximize too, and they fire whether or not the
 * window is small — so restoring the remembered size unconditionally would snap the window
 * back to however big it was at the last trip to the mini player, discarding a resize made
 * since. Hence the mode flag: the remembered size is applied only when leaving the mini
 * player, and at every other moment the window keeps whatever size it has.
 *
 * Size only, not position. The window is where the listener put it, and growing it back from
 * there is less startling than teleporting it to where it used to be.
 */

const MINI = {height: 120, width: 320};
/** Only used until the window has been full-size once, which is how it starts. */
const DEFAULT_MAX = {height: 800, width: 1430};

let mini = false;
let remembered = null;

/** Shrinks to the mini player, remembering the size being left behind. */
function toMini(win) {
  if (!win) {
    return;
  }
  if (!mini) {
    const [width, height] = win.getSize();
    remembered = {height, width};
    mini = true;
  }
  win.setSize(MINI.width, MINI.height);
}

/**
 * Back to the full browser, at the size it was left at.
 *
 * A no-op when the window is already full size, which is what stops the three "jump to this"
 * callers from resetting a size the listener has changed since.
 */
function toMax(win) {
  if (!win || !mini) {
    return;
  }
  mini = false;
  const size = remembered || DEFAULT_MAX;
  win.setSize(size.width, size.height);
}

/** Exported for the tests; the window is created once, so nothing else needs it. */
function reset() {
  mini = false;
  remembered = null;
}

module.exports = {DEFAULT_MAX, MINI, reset, toMax, toMini};
