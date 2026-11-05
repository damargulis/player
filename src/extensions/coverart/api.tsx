/**
 * Cover Art Archive client.
 *
 * CAA is free and keyless, serves art keyed by the MusicBrainz release-group id this library
 * already stores for 2,008 albums, and is a separate host from the MusicBrainz API — so the
 * 1 req/sec rule that `musicbrainz/api.tsx` obeys does not apply here. Their docs say there
 * are no rate limits in place, but every endpoint documents a 503 for exceeding one, so this
 * paces itself anyway and backs off when told to.
 *
 * Sizes measured against 25 real release-groups from this library, all of which had every
 * size available:
 *
 *   front-500    500px median,  62KB  ->  129MB for the whole library
 *   front-1200  1200px median, 206KB  ->  458MB
 *   front       up to 2848px,  372KB  -> 1855MB
 *
 * 1200 is the target: the originals are four times the bytes for detail nothing in the app can
 * show, and 500 is what the MusicBrainz extension already fetched.
 */

const BASE_URL = 'https://coverartarchive.org';
/** Polite rather than required; CAA publishes no limit but documents a 503 for exceeding one. */
const REQUEST_SPACING_MS = 150;
const RETRYABLE_STATUSES = [429, 500, 502, 503, 504];
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 1500;

/** Preference order. A release-group with no 1200 still usually has a 500. */
export const SIZES = ['front-1200', 'front-500'];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let queue = Promise.resolve() as Promise<unknown>;

/** Serialises every request through one chain, as the MusicBrainz and LRCLIB clients do. */
function paced<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work);
  queue = result.then(() => delay(REQUEST_SPACING_MS), () => delay(REQUEST_SPACING_MS));
  return result;
}

function fetchWithRetry(url: string, attempt: number = 1): Promise<Response> {
  return fetch(url).then((res) => {
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

/**
 * Downloads the front cover for a release-group, largest available first.
 *
 * Resolves undefined when the community has chosen no front image, which CAA answers with a
 * 404 — an ordinary outcome for an obscure release, not an error.
 */
export function fetchFrontCover(mbid: string): Promise<Buffer | undefined> {
  const trySize = (index: number): Promise<Buffer | undefined> => {
    if (index >= SIZES.length) {
      return Promise.resolve(undefined);
    }
    return paced(() => fetchWithRetry(`${BASE_URL}/release-group/${mbid}/${SIZES[index]}`))
      .then((res) => {
        if (res.status === 404) {
          // no front image at this size; a smaller one may still exist
          return trySize(index + 1);
        }
        if (!res.ok) {
          return Promise.reject(new Error(`Cover Art Archive: ${res.status}`));
        }
        return res.arrayBuffer().then((data) => Buffer.from(data));
      });
  };
  return trySize(0);
}
