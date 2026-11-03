/**
 * LRCLIB client.
 *
 * Genius deliberately serves metadata and a page url but never the lyrics text — it licenses
 * from publishers and cannot redistribute it — so the existing extension can only ever link
 * out. LRCLIB is a free, keyless database that returns the words, often with LRC timestamps.
 *
 * Measured against this library before building: among clean responses, ~92% of a spread
 * sample matched and ~76% of those carried timestamps; for most-played tracks it was 100% and
 * 91%. The catch is reliability, not coverage — roughly 40% of requests return 503, which is
 * why everything here goes through a paced queue with retries.
 */

const API_BASE = 'https://lrclib.net/api';
/**
 * ~75 requests/minute, under the ~90 the docs allow an identified client.
 *
 * A first probe at 350ms (~170/min) produced nothing but errors. The pool runs seven items at
 * once, so the spacing has to live here rather than in the caller, exactly as the MusicBrainz
 * client does.
 */
const REQUEST_SPACING_MS = 800;
/** The docs ask for an identifying agent; it also doubles the rate allowance. */
const USER_AGENT = 'MyMusic/0.1.0 (https://github.com/damargulis/player)';

const RETRYABLE_STATUSES = [429, 500, 502, 503, 504];
const MAX_ATTEMPTS = 4;
const RETRY_BASE_MS = 1200;

export interface LyricsResult {
  /** LRC text with timestamps, when the database has a synced version. */
  synced?: string;
  /** Plain text, always present when the track is not instrumental. */
  plain?: string;
  instrumental: boolean;
}

interface LrclibResponse {
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
  instrumental?: boolean;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 503s are the normal failure here rather than the exception, so one attempt is not enough. */
function fetchWithRetry(url: string, attempt: number = 1): Promise<Response> {
  return fetch(url, {headers: {'User-Agent': USER_AGENT}}).then((res) => {
    if (RETRYABLE_STATUSES.includes(res.status) && attempt < MAX_ATTEMPTS) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const wait = retryAfter > 0 ? retryAfter * 1000 : attempt * RETRY_BASE_MS;
      return delay(wait).then(() => fetchWithRetry(url, attempt + 1));
    }
    return res;
  }, (err) => {
    if (attempt < MAX_ATTEMPTS) {
      return delay(attempt * RETRY_BASE_MS).then(() => fetchWithRetry(url, attempt + 1));
    }
    return Promise.reject(err);
  });
}

let queue = Promise.resolve() as Promise<unknown>;

/** Serialises every request through one chain, so concurrency upstream cannot outpace the API. */
function paced<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work);
  queue = result.then(() => delay(REQUEST_SPACING_MS), () => delay(REQUEST_SPACING_MS));
  return result;
}

export interface LyricsQuery {
  title: string;
  artist: string;
  album: string;
  /** Milliseconds, as the library stores it; converted to seconds for the API. */
  durationMs: number;
}

/**
 * Looks a track up. Resolves undefined when there is no match (a 404, which is ordinary).
 *
 * Duration is sent because it is what makes the match trustworthy: title and artist alone
 * cannot tell a single from an album cut, a remaster or a live version.
 */
export function fetchLyrics(query: LyricsQuery): Promise<LyricsResult | undefined> {
  const params = new URLSearchParams({
    album_name: query.album,
    artist_name: query.artist,
    track_name: query.title,
  });
  const seconds = Math.round(query.durationMs / 1000);
  if (seconds > 0 && seconds <= 3600) {
    params.set('duration', String(seconds));
  }
  return paced(() => fetchWithRetry(`${API_BASE}/get?${params}`).then((res) => {
    if (res.status === 404) {
      return undefined;
    }
    if (!res.ok) {
      return Promise.reject(new Error(`LRCLIB request failed: ${res.status}`));
    }
    return res.json().then((body: LrclibResponse) => {
      if (body.instrumental) {
        return {instrumental: true};
      }
      const synced = body.syncedLyrics || undefined;
      const plain = body.plainLyrics || undefined;
      if (!synced && !plain) {
        return undefined;
      }
      return {instrumental: false, plain, synced};
    });
  }));
}
