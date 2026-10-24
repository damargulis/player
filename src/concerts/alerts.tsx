import {loadCache} from './store';

/**
 * How many newly announced shows are waiting, shared between the sidebar badge and the
 * concerts tab. Kept here rather than in Redux because it is derived from a file on disk,
 * not from library state, and only two components care.
 */
let count: number | undefined;
const listeners: Array<() => void> = [];

export function unseenCount(): number {
  if (count === undefined) {
    // read lazily so the badge is right on launch without the tab ever being opened
    count = loadCache().unseen.length;
  }
  return count;
}

export function setUnseenCount(next: number): void {
  if (next === count) {
    return;
  }
  count = next;
  listeners.slice().forEach((listener) => listener());
}

export function subscribeUnseen(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    const i = listeners.indexOf(listener);
    if (i >= 0) {
      listeners.splice(i, 1);
    }
  };
}
