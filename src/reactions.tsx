import {Track, TrackReaction} from './redux/actionTypes';

export type Reaction = 'like' | 'dislike' | 'none';

/** Blank slate for someone who hasn't reacted to a track yet. */
function emptyReaction(): TrackReaction {
  return {disliked: [], liked: []};
}

function reactionFor(track: Track, person: string): TrackReaction {
  const existing = track.reactions && track.reactions[person];
  return existing ? {disliked: existing.disliked || [], liked: existing.liked || []} : emptyReaction();
}

/** What this person currently thinks of the track, in the given year. */
export function currentReaction(track: Track, person: string, year: number): Reaction {
  const reaction = reactionFor(track, person);
  if (reaction.liked.indexOf(year) >= 0) {
    return 'like';
  }
  if (reaction.disliked.indexOf(year) >= 0) {
    return 'dislike';
  }
  return 'none';
}

/**
 * Records a verdict, returning the whole reactions map so it can be merged by UPDATE_TRACK.
 * Liking clears a dislike for that year and vice versa — a person holds one opinion at a time —
 * and pressing the same button again clears it.
 */
export function applyReaction(
  track: Track, person: string, reaction: Reaction, year: number,
): Record<string, TrackReaction> {
  const current = reactionFor(track, person);
  const liked = current.liked.filter((y) => y !== year);
  const disliked = current.disliked.filter((y) => y !== year);
  if (reaction === 'like') {
    liked.push(year);
  } else if (reaction === 'dislike') {
    disliked.push(year);
  }
  const next = Object.assign({}, track.reactions);
  if (!liked.length && !disliked.length) {
    delete next[person];
  } else {
    next[person] = {disliked, liked};
  }
  return next;
}

/** Flips a verdict off when pressed again, so one button both sets and clears. */
export function toggleReaction(track: Track, person: string, pressed: Reaction, year: number): Reaction {
  return currentReaction(track, person, year) === pressed ? 'none' : pressed;
}

/** Everyone who has reacted to this track, for display and for the DJ. */
export function describeReactions(track: Track, year: number): string {
  const reactions = track.reactions;
  if (!reactions) {
    return '';
  }
  const parts: string[] = [];
  Object.keys(reactions).sort().forEach((person) => {
    const verdict = currentReaction(track, person, year);
    if (verdict === 'like') {
      parts.push(`♥${person}`);
    } else if (verdict === 'dislike') {
      parts.push(`✗${person}`);
    }
  });
  return parts.join(' ');
}
