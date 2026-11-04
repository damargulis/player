import {createMessage} from './api';

/**
 * Clues for the "Guess the Artist" game: the DJ describes a track without naming it.
 *
 * Lives beside the rest of `src/dj/` because it shares the API client, the key and the
 * selected model — the game window has none of those, so it asks over IPC and `App.tsx`
 * calls this. One Messages API call per round, which is why rounds are few and the game
 * fetches the next clue while the player is still working on the current one.
 */

export interface ClueTrack {
  name: string;
  artist: string;
  album?: string;
  year?: number;
  genres?: string[];
}

/** Short on purpose: a clue is three sentences, and a long one is a worse puzzle anyway. */
const MAX_TOKENS = 400;

const SYSTEM = `You are the DJ for a private music library, writing clues for a guessing game.

Given one track, write a clue of two or three short sentences that would let a knowledgeable
listener work out WHO the artist is. Write it the way a radio DJ talks between songs: specific,
warm, a little sly. Lean on the things that identify a band — the scene and city they came out
of, the era, how they sound, who they are usually mentioned alongside, what they are known for.

Hard rules:
- Never write the artist's name, the band's name, or any member's name.
- Never write the song title or the album title.
- Do not spell a name out, abbreviate it, initialise it, rhyme it, or hint at its letters.
- Do not mention another artist's name only to say the answer is not them.
- Naming other artists as comparisons is fine and encouraged, as long as they are not the answer.
- No preamble and no sign-off. Reply with the clue text only.`;

/** Everything the clue may draw on, which is everything the library knows about the track. */
function describe(track: ClueTrack): string {
  const lines = [`Song: ${track.name}`, `Artist: ${track.artist}`];
  if (track.album) {
    lines.push(`Album: ${track.album}`);
  }
  if (track.year && track.year > 1000) {
    lines.push(`Year: ${track.year}`);
  }
  if (track.genres && track.genres.length) {
    lines.push(`Genres: ${track.genres.join(', ')}`);
  }
  return lines.join('\n');
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Blanks out anything that gives the answer away.
 *
 * The prompt asks the model not to name the artist or the title, and it mostly obliges — but a
 * clue that leaks the answer is a round silently wasted, and a second call to fix it costs as
 * much as the first. Redacting is cheap, and a visible `███` reads as deliberate rather than
 * broken.
 */
export function redact(clue: string, track: ClueTrack): string {
  const secrets = [track.name, track.artist].concat(track.album ? [track.album] : []);
  // Individual words are not secrets on their own — "Love" would gut half the clues — but a
  // credit like "A, B" hides two separate answers, so each named artist is blanked.
  track.artist.split(', ').forEach((name) => secrets.push(name));
  let result = clue;
  secrets
    .map((secret) => secret.trim())
    .filter((secret) => secret.length > 2)
    // longest first, so blanking "Pink" cannot stop "Pink Floyd" from matching
    .sort((first, second) => second.length - first.length)
    .forEach((secret) => {
      result = result.replace(new RegExp(escapeForRegExp(secret), 'gi'), '███');
    });
  return result;
}

/** The clue text for one track. Rejects with the API's message when the call fails. */
export async function djClue(track: ClueTrack): Promise<string> {
  const response = await createMessage({
    effort: 'low',
    maxTokens: MAX_TOKENS,
    messages: [{role: 'user', content: [{type: 'text', text: describe(track)}]}],
    system: SYSTEM,
    tools: [],
  });
  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as {text: string}).text)
    .join('\n')
    .trim();
  if (!text) {
    throw new Error('The DJ had nothing to say about that one');
  }
  return redact(text, track);
}
