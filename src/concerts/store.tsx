import {Artist} from '../redux/actionTypes';
import {FetchedEvent, sweep} from './api';
import {DATA_DIR} from '../constants';
import fs from 'fs';
import {
  Concert,
  ConcertCache,
  ConcertLocation,
  currentMonth,
  emptyCache,
  MONTHLY_CALL_BUDGET,
} from './types';
import {localDate} from '../utils';

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

/** Artists keyed by MusicBrainz id, which is how JamBase performers are matched. */
export function artistsByMbid(artists: Artist[]): Record<string, string> {
  const map: Record<string, string> = {};
  artists.forEach((artist) => {
    if (artist.mbid) {
      map[artist.mbid.toLowerCase()] = artist.id;
    }
  });
  return map;
}

/**
 * Keeps only shows featuring someone in the library. Matching is on MusicBrainz id, so there is
 * no chance of confusing two bands that share a name.
 */
export function matchConcerts(events: FetchedEvent[], byMbid: Record<string, string>): Concert[] {
  const matched: Record<string, Concert> = {};
  events.forEach(({concert, mbids}) => {
    const artistIds: string[] = [];
    mbids.forEach((mbid) => {
      // the api client lowercases these, but don't depend on the caller having done it
      const artistId = byMbid[String(mbid).toLowerCase()];
      if (artistId && artistIds.indexOf(artistId) < 0) {
        artistIds.push(artistId);
      }
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
export async function refreshConcerts(artists: Artist[], options: RefreshOptions = {}): Promise<ConcertCache> {
  const cache = loadCache();
  const location = options.location || cache.location;
  const locationChanged = JSON.stringify(location) !== JSON.stringify(cache.location);
  if (!options.force && !locationChanged && !isStale(cache)) {
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
    const concerts = matchConcerts(result.events, artistsByMbid(artists));
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
