/**
 * Whoever is at the desktop or on the Android app; other clients name themselves. Lives alone
 * so both session.tsx and tools.tsx can use it without importing each other.
 */
export const OWNER = 'Daniel';

/**
 * What the DJ is called in the transcript.
 *
 * Its messages had no name at all while everyone else's did, so they read as the one voice in
 * the room without an owner. It lives here beside OWNER because the same three clients need
 * both, and it rides in the snapshot rather than being hard-coded in each of them — the
 * speaker-colour hash, the clock format and the owner rule are already three things that have
 * to be kept in step across DJPage.tsx, public/dj-web/index.html and DJChatScreen.kt.
 *
 * The colour comes from the hash like anyone else's, so no client needs a special case: "DJ
 * Claude" lands on rose, which is nothing like Daniel's blue or Chloe's teal.
 */
export const DJ_NAME = 'DJ Claude';
