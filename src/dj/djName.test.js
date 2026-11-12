import {DJ_NAME, OWNER} from './owner';
import session from './session';

/**
 * The DJ's name reaches three clients (DJPage.tsx, public/dj-web/index.html and
 * DJChatScreen.kt) through the snapshot rather than being written into each of them, which is
 * the mistake the speaker-colour hash, the clock format and the owner rule all made. If it
 * stops being sent, every client silently falls back to an unnamed DJ — the thing this fixed.
 */

test('the snapshot carries the name', () => {
  session.reset();
  const snapshot = session.getChatState();
  expect(snapshot.djName).toBe(DJ_NAME);
});

test('the owner is still carried alongside it', () => {
  session.reset();
  expect(session.getChatState().owner).toBe(OWNER);
});

test('the name is distinct from a person in the house', () => {
  // a DJ sharing the owner's name would make the transcript unreadable
  expect(DJ_NAME).not.toBe(OWNER);
  expect(DJ_NAME.trim()).not.toBe('');
});
