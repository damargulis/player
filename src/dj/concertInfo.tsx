import {concertsForArtists, resetConcertIndex} from '../concerts/store';
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

/** Kept for tests and for callers that refresh the cache; the shared index does the caching. */
export function resetConcertInfo(): void {
  resetConcertIndex();
}

export function showsForArtist(artistId: string): Concert[] {
  return concertsForArtists([artistId]);
}

export function showsForArtists(artistIds: string[]): Concert[] {
  return concertsForArtists(artistIds);
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
