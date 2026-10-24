import {loadCache} from '../concerts/store';
import {Concert} from '../concerts/types';
import {localDate} from '../utils';

/**
 * Upcoming shows, for the DJ.
 *
 * Deliberately reaches only a few places: the artist lookups, and the views of what is already
 * playing or queued. It is kept out of search_library, sample_tracks and search_albums on
 * purpose — those are how the DJ picks what to play, and a tour date sitting next to a
 * candidate is exactly how you end up with a set chosen for who happens to be touring.
 */

/** Re-reading the cache file for every formatted line would be silly; it barely changes. */
const TTL_MS = 30 * 1000;
let cached: {at: number; byArtist: Record<string, Concert[]>} | undefined;

function byArtist(): Record<string, Concert[]> {
  if (cached && Date.now() - cached.at < TTL_MS) {
    return cached.byArtist;
  }
  const map: Record<string, Concert[]> = {};
  try {
    loadCache().concerts.forEach((concert) => {
      concert.artistIds.forEach((artistId) => {
        map[artistId] = (map[artistId] || []).concat([concert]);
      });
    });
  } catch (err) {
    // no concerts cached yet; the DJ simply never mentions shows
  }
  cached = {at: Date.now(), byArtist: map};
  return map;
}

/** Forgets the memoised cache; used by tests and after a refresh. */
export function resetConcertInfo(): void {
  cached = undefined;
}

export function showsForArtist(artistId: string): Concert[] {
  return (byArtist()[artistId] || []).slice().sort((a, b) => a.date.localeCompare(b.date));
}

export function showsForArtists(artistIds: string[]): Concert[] {
  const seen: Record<string, boolean> = {};
  const out: Concert[] = [];
  artistIds.forEach((artistId) => {
    showsForArtist(artistId).forEach((concert) => {
      if (!seen[concert.id]) {
        seen[concert.id] = true;
        out.push(concert);
      }
    });
  });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function showDate(concert: Concert): string {
  const date = localDate(concert.date);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function describeShow(concert: Concert): string {
  const where = [concert.venue, concert.city].filter(Boolean).join(', ');
  return `${showDate(concert)} at ${where || 'a venue nearby'}`;
}

/** Compact tail for an artist line, empty when they have nothing coming up. */
export function artistShowMarker(artistId: string): string {
  const shows = showsForArtist(artistId);
  if (!shows.length) {
    return '';
  }
  const first = ` · playing ${showDate(shows[0])}`;
  return shows.length > 1 ? `${first} (+${shows.length - 1} more)` : first;
}
