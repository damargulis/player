import {readEnvValue} from '../../envFile';

/**
 * Genius API access, with the rate limit handled rather than swallowed.
 *
 * The old code did `res.text()` then `JSON.parse()` with a bare `.catch(() => {})`. Genius
 * answers a rate limit with **HTML**, not JSON, so the parse threw and the catch hid it — a
 * throttled track looked exactly like a track with no match, and once the limit was hit a sweep
 * would run through the rest of the library recording nothing while appearing to work.
 *
 * Genius publishes no limit, but answers 429 with a `Retry-After` measured in **thousands of
 * seconds** (an hour-ish quota). That is far too long to sit in a retry loop, so hitting it
 * stops the run instead: the remaining calls short-circuit, and the summary says when to resume.
 */

const TOKEN_KEY = 'GENIUS_ACCESS_TOKEN';
/** Genius tolerates bursts, but a 21k-track sweep is not a burst. */
const REQUEST_SPACING_MS = 150;
const RETRYABLE_STATUSES = [500, 502, 503, 504];
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 1000;

export function getAccessToken(): string | undefined {
  return readEnvValue(TOKEN_KEY);
}

export function tokenName(): string {
  return TOKEN_KEY;
}

/** Thrown once the quota is gone; carries when it frees up. */
export class GeniusRateLimited extends Error {
  public retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(`Genius rate limit reached; retry in ${retryAfterSeconds}s`);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Set once a 429 is seen, so the rest of the run stops asking.
 *
 * Without this the pool keeps firing requests that cannot succeed — thousands of them, each
 * recording nothing, for as long as the sweep takes.
 */
let limitedUntil = 0;

export function rateLimitedUntil(): number {
  return limitedUntil;
}

export function isRateLimited(): boolean {
  return limitedUntil > Date.now();
}

/** Lets a fresh run try again without restarting the app. */
export function clearRateLimit(): void {
  limitedUntil = 0;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let queue = Promise.resolve() as Promise<unknown>;

function paced<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work);
  queue = result.then(() => delay(REQUEST_SPACING_MS), () => delay(REQUEST_SPACING_MS));
  return result;
}

function request(url: string, attempt: number = 1): Promise<Response> {
  return fetch(url, {headers: {Authorization: `Bearer ${getAccessToken()}`}}).then((res) => {
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after')) || 3600;
      limitedUntil = Date.now() + retryAfter * 1000;
      return Promise.reject(new GeniusRateLimited(retryAfter));
    }
    if (RETRYABLE_STATUSES.includes(res.status) && attempt < MAX_ATTEMPTS) {
      return delay(attempt * RETRY_BASE_MS).then(() => request(url, attempt + 1));
    }
    return res;
  });
}

/**
 * Fetches and parses a Genius endpoint.
 *
 * Checks `res.ok` before parsing, because an error response is an HTML page and parsing it as
 * JSON is what hid the rate limit in the first place.
 */
export function geniusJson(url: string): Promise<Record<string, unknown>> {
  if (isRateLimited()) {
    return Promise.reject(new GeniusRateLimited(
      Math.ceil((limitedUntil - Date.now()) / 1000)));
  }
  return paced(() => request(url).then((res) => {
    if (!res.ok) {
      return Promise.reject(new Error(`Genius request failed: ${res.status}`));
    }
    return res.json() as Promise<Record<string, unknown>>;
  }));
}

/** "58 minutes" reads better than "3506 seconds" in the extension window. */
export function describeWait(seconds: number): string {
  if (seconds < 90) {
    return `${Math.ceil(seconds)} seconds`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) {
    return `${minutes} minutes`;
  }
  return `${(minutes / 60).toFixed(1)} hours`;
}
