import {Artist} from '../redux/actionTypes';
import {FetchedEvent, FetchedPerformer, sweep} from './api';
import {DATA_DIR} from '../constants';
import {externalEffectsAllowed} from '../devSafety';
import fs from 'fs';
import {
  Concert,
  ConcertCache,
  ConcertLocation,
  currentMonth,
  emptyCache,
  MONTHLY_CALL_BUDGET,
} from './types';
import {foldForSearch, localDate, nameKey} from '../utils';

/**
 * Concerts live in their own file rather than in library.json. They expire, they churn on every
 * refresh, and the library is a large file that gets backed up daily — mixing volatile data into
 * it would risk real data for something we can always re-fetch.
 */
const CACHE_FILE = () => `${DATA_DIR}/concerts.json`;

/**
 * Refresh at most once a day. A sweep is roughly 25 pages in a dense metro, so twice-daily
 * would cost ~1500 calls a month against a 1000 budget; daily lands near 750 and leaves room
 * for manual refreshes and city lookups.
 */
export const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function loadCache(): ConcertCache {
  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE_FILE(), 'utf8')) as ConcertCache;
    const cache = Object.assign(emptyCache(), parsed);
    if (cache.usage.month !== currentMonth()) {
      cache.usage = {calls: 0, month: currentMonth()};
    }
    return cache;
  } catch (err) {
    // no cache yet, or it is unreadable; a fresh one costs nothing to rebuild
    return emptyCache();
  }
}

export function saveCache(cache: ConcertCache): void {
  byArtist = undefined;
  try {
    fs.writeFileSync(CACHE_FILE(), JSON.stringify(cache), 'utf8');
  } catch (err) {
    // a cache we cannot persist is still usable in memory for this session
  }
}

/**
 * Shows keyed by library artist id, built once and dropped whenever the cache is rewritten.
 *
 * The now-playing badge asks this on every track change, and reading and re-scanning a JSON
 * file that many times would be silly for data that changes once a day. Every write goes
 * through `saveCache`, so that is the only place the index can go stale.
 */
let byArtist: Record<string, Concert[]> | undefined;

/** Drops the memoised index. `saveCache` does this already; tests and refreshes use it too. */
export function resetConcertIndex(): void {
  byArtist = undefined;
}

/**
 * Whether a show still lies ahead.
 *
 * Midnight today, so a gig later tonight still counts and yesterday's does not. **This is the
 * only definition of "upcoming" — every view must go through it.** The cache keeps shows until
 * the next sweep, and sweeps are daily at best, so anything reading it raw will sooner or later
 * present a gig that has already happened as upcoming. That is exactly what three separate
 * copies of this logic did.
 */
export function isUpcoming(concert: Concert, now: Date = new Date()): boolean {
  const today = new Date(now.getTime());
  today.setHours(0, 0, 0, 0);
  return localDate(concert.date).getTime() >= today.getTime();
}

/** Every show still ahead, soonest first. */
export function upcomingConcerts(cache: ConcertCache = loadCache()): Concert[] {
  return cache.concerts
    .filter((concert) => isUpcoming(concert))
    .sort((a, b) => localDate(a.date).getTime() - localDate(b.date).getTime());
}

function concertIndex(): Record<string, Concert[]> {
  if (byArtist) {
    return byArtist;
  }
  const built: Record<string, Concert[]> = {};
  loadCache().concerts.forEach((concert) => {
    if (!isUpcoming(concert)) {
      return;
    }
    concert.artistIds.forEach((artistId) => {
      built[artistId] = built[artistId] || [];
      built[artistId].push(concert);
    });
  });
  Object.keys(built).forEach((artistId) => {
    built[artistId].sort((a, b) => localDate(a.date).getTime() - localDate(b.date).getTime());
  });
  byArtist = built;
  return built;
}

export type ConcertFilter = 'all' | 'favorites' | 'recent' | 'new';

export interface FilterContext {
  favoriteArtistIds: string[];
  recentArtistIds: string[];
  /** Ids flagged as newly announced this session; survives `markSeen`. */
  highlighted: string[];
}

/**
 * Whether a show belongs in the current view.
 *
 * Lives here beside `isUpcoming` so the list and the calendar cannot disagree about what is
 * shown - they both go through `visibleConcerts`, and this is the half that varies.
 */
export function matchesFilter(concert: Concert, filter: ConcertFilter,
                              context: FilterContext): boolean {
  if (filter === 'favorites') {
    return concert.artistIds.some((id) => context.favoriteArtistIds.indexOf(id) >= 0);
  }
  if (filter === 'recent') {
    return concert.artistIds.some((id) => context.recentArtistIds.indexOf(id) >= 0);
  }
  if (filter === 'new') {
    return context.highlighted.indexOf(concert.id) >= 0;
  }
  return true;
}

/**
 * Upcoming shows for any of these artists, soonest first.
 *
 * Takes a list because a track can credit several artists, and a show by any of them is worth
 * flagging. De-duplicated by event id, since a collaboration lists both performers.
 */
export function concertsForArtists(artistIds: string[]): Concert[] {
  const index = concertIndex();
  const seen: Record<string, boolean> = {};
  const out: Concert[] = [];
  artistIds.forEach((artistId) => {
    (index[artistId] || []).forEach((concert) => {
      if (!seen[concert.id]) {
        seen[concert.id] = true;
        out.push(concert);
      }
    });
  });
  return out.sort((a, b) => localDate(a.date).getTime() - localDate(b.date).getTime());
}

/** What matching needs to know about a library artist. Built by the page, which has the genres. */
export interface MatchableArtist {
  id: string;
  name: string;
  /** Genre names, e.g. "Indie Rock". */
  genres: string[];
}

/**
 * Folded names at or under this length are short enough to collide with an unrelated act — a
 * JamBase "Bob" or "44" at a bar is rarely the artist in the library — so they also need a genre
 * in common. 70 artists here are that short; the rest match on the name alone.
 */
export const SHORT_NAME = 4;

/**
 * JamBase's own genre slugs, widened to the words a library genre would use for the same thing.
 * Word overlap does most of the work ("rock" meets "Alternative Rock"); this is for the slugs that
 * share no word with their equivalent.
 */
const GENRE_ALIASES: Record<string, string[]> = {
  edm: ['electronic', 'electronica', 'dance', 'house', 'techno'],
  jamband: ['jam'],
  rap: ['hiphop'],
};

/** Every word in a set of genre names, folded, plus the aliases of each. */
function genreWords(genres: string[]): Set<string> {
  const words = new Set<string>();
  genres.forEach((genre) => {
    foldForSearch(genre).split(/[^a-z0-9]+/).filter((word) => word && word !== 'and' && word !== 'music')
      .forEach((word) => {
        words.add(word);
        (GENRE_ALIASES[word] || []).forEach((alias) => words.add(alias));
      });
    // "hip-hop-rap" and "Hip Hop" both reduce to this once the separators go
    words.add(nameKey(genre));
  });
  return words;
}

export function shareAGenre(one: string[], two: string[]): boolean {
  const words = genreWords(one);
  return Array.from(genreWords(two)).some((word) => words.has(word));
}

/** Library artists by folded name. A list, because a few names here belong to more than one. */
export function artistsByName(artists: MatchableArtist[]): Record<string, MatchableArtist[]> {
  const map: Record<string, MatchableArtist[]> = {};
  artists.forEach((artist) => {
    const key = nameKey(artist.name);
    if (key) {
      (map[key] = map[key] || []).push(artist);
    }
  });
  return map;
}

/**
 * Whether a performer on a bill is this library artist.
 *
 * The exact folded name, never a partial one — "Pearl" must not become "Pearl Jam". And for a name
 * short enough to collide, a genre in common as well. This is the cost of matching on names at
 * all: it used to be exact on MusicBrainz id, which JamBase now only supplies on a paid plan.
 */
export function performerMatches(performer: FetchedPerformer, artist: MatchableArtist): boolean {
  if (nameKey(performer.name) !== nameKey(artist.name)) {
    return false;
  }
  if (nameKey(artist.name).length > SHORT_NAME) {
    return true;
  }
  return shareAGenre(performer.genres, artist.genres);
}

/** Keeps only shows featuring someone in the library. */
export function matchConcerts(
  events: FetchedEvent[],
  byName: Record<string, MatchableArtist[]>,
): Concert[] {
  const matched: Record<string, Concert> = {};
  events.forEach(({concert, performers}) => {
    const artistIds: string[] = [];
    performers.forEach((performer) => {
      (byName[nameKey(performer.name)] || []).forEach((artist) => {
        if (performerMatches(performer, artist) && artistIds.indexOf(artist.id) < 0) {
          artistIds.push(artist.id);
        }
      });
    });
    if (!artistIds.length) {
      return;
    }
    const existing = matched[concert.id];
    if (existing) {
      artistIds.forEach((id) => {
        if (existing.artistIds.indexOf(id) < 0) {
          existing.artistIds.push(id);
        }
      });
      return;
    }
    matched[concert.id] = Object.assign({}, concert, {artistIds});
  });
  return Object.values(matched).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Which shows are newly announced. Carries forward anything still unseen from an earlier
 * refresh, so shows aren't lost when several refreshes happen between visits, and stays empty
 * on the very first sweep — when everything is technically new, flagging it all is just noise.
 */
export function findUnseen(previous: ConcertCache, concerts: Concert[]): string[] {
  if (!previous.fetchedAt) {
    return [];
  }
  const previousIds: Record<string, boolean> = {};
  previous.concerts.forEach((concert) => {
    previousIds[concert.id] = true;
  });
  const carried = previous.unseen || [];
  const unseen: string[] = [];
  concerts.forEach((concert) => {
    const isNew = !previousIds[concert.id];
    const stillUnseen = carried.indexOf(concert.id) >= 0;
    if ((isNew || stillUnseen) && unseen.indexOf(concert.id) < 0) {
      unseen.push(concert.id);
    }
  });
  return unseen;
}

/** Clears the badge once the listener has actually looked. */
export function markSeen(): ConcertCache {
  const cache = loadCache();
  if (!cache.unseen.length) {
    return cache;
  }
  const next = Object.assign({}, cache, {unseen: []});
  saveCache(next);
  return next;
}

export function isStale(cache: ConcertCache): boolean {
  return !cache.fetchedAt || Date.now() - cache.fetchedAt > REFRESH_INTERVAL_MS;
}

export function budgetRemaining(cache: ConcertCache): number {
  const usage = cache.usage.month === currentMonth() ? cache.usage.calls : 0;
  return Math.max(0, MONTHLY_CALL_BUDGET - usage);
}

export interface RefreshOptions {
  location?: ConcertLocation;
  /** Refresh even if the cache is fresh. */
  force?: boolean;
  onProgress?(page: number, totalPages: number): void;
}

/**
 * Re-sweeps and re-matches, writing the result to disk. Returns the cache unchanged when it is
 * still fresh or the monthly budget is spent, so callers can always just ask.
 */
export async function refreshConcerts(
  artists: MatchableArtist[],
  options: RefreshOptions = {},
): Promise<ConcertCache> {
  const cache = loadCache();
  const location = options.location || cache.location;
  const locationChanged = JSON.stringify(location) !== JSON.stringify(cache.location);
  if (!options.force && !locationChanged && !isStale(cache)) {
    return cache;
  }
  // only an automatic refresh is gated: pressing Refresh or choosing a city is intentional, but a
  // dev copy opening the tab spent ~21 of the month's 1,000 calls on its own (see devSafety.tsx)
  if (!options.force && !locationChanged && !externalEffectsAllowed('concerts')) {
    return cache;
  }
  if (budgetRemaining(cache) <= 0) {
    const next = Object.assign({}, cache, {
      error: `Monthly JamBase call budget (${MONTHLY_CALL_BUDGET}) is used up. It resets next month.`,
      location,
    });
    saveCache(next);
    return next;
  }
  try {
    const result = await sweep(location, options.onProgress);
    const concerts = matchConcerts(result.events, artistsByName(artists));
    const next: ConcertCache = {
      concerts,
      error: undefined,
      fetchedAt: Date.now(),
      location,
      unseen: findUnseen(cache, concerts),
      usage: {calls: cache.usage.calls + result.calls, month: currentMonth()},
    };
    saveCache(next);
    return next;
  } catch (err) {
    const next = Object.assign({}, cache, {
      error: err instanceof Error ? err.message : String(err),
      location,
    });
    saveCache(next);
    return next;
  }
}
