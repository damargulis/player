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
  try {
    fs.writeFileSync(CACHE_FILE(), JSON.stringify(cache), 'utf8');
  } catch (err) {
    // a cache we cannot persist is still usable in memory for this session
  }
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
    const next: ConcertCache = {
      concerts: matchConcerts(result.events, artistsByMbid(artists)),
      error: undefined,
      fetchedAt: Date.now(),
      location,
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
