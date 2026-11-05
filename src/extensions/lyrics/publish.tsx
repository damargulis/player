import crypto from 'crypto';

/**
 * Submitting corrections back to LRCLIB.
 *
 * LRCLIB is a community database (MIT-licensed, `github.com/tranxuanthang/lrclib`) and
 * `POST /api/publish` is open and anonymous — no key, no account. Publishing a correction for a
 * track that already has lyrics keeps every earlier revision, so this adds a version rather
 * than overwriting anyone's work.
 *
 * The anti-spam measure is a proof of work. Each publish needs a single-use `X-Publish-Token`
 * of `{prefix}:{nonce}`, where the prefix comes from `POST /api/request-challenge` and the
 * nonce has to be found by brute force. The rule, from LRCGET's `challenge_solver.rs` which the
 * API docs point at as the reference: SHA-256 the prefix concatenated with the nonce's decimal
 * string, and accept the first nonce whose digest is **less than or equal to** the target when
 * both are compared as unsigned big-endian bytes.
 */

const API_BASE = 'https://lrclib.net/api';
const USER_AGENT = 'MyMusic/0.1.0 (https://github.com/damargulis/player)';

/**
 * Hashes attempted between yields to the event loop.
 *
 * A tight brute-force loop would lock the renderer — the thread drawing the UI — for the whole
 * solve, and that is not a brief moment: measured against the live API, the target is
 * `000000FF…`, so roughly 2^24 hashes at about 670k/sec on this machine. Three real challenges
 * solved in 1.0s, 19.3s and 4.5s; the spread is the nature of the search, not a fluke. This
 * batch is ~30ms of work, which keeps the window responsive and progress moving.
 */
const BATCH_SIZE = 20000;
/** Far past any plausible solve, so a broken target fails instead of spinning forever. */
const MAX_ATTEMPTS = 500000000;

export interface Challenge {
  prefix: string;
  target: string;
}

/** True when `digest` <= `target`, comparing unsigned bytes left to right. */
export function meetsTarget(digest: Buffer, target: Buffer): boolean {
  if (digest.length !== target.length) {
    return false;
  }
  for (let i = 0; i < digest.length; i++) {
    if (digest[i] > target[i]) {
      return false;
    }
    if (digest[i] < target[i]) {
      return true;
    }
  }
  // every byte equal still counts; the rule is <=, not <
  return true;
}

export function hashAttempt(prefix: string, nonce: number): Buffer {
  return crypto.createHash('sha256').update(`${prefix}${nonce}`).digest();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface SolveHooks {
  /** Called between batches with the attempts so far; a solve can run for tens of seconds. */
  onProgress?(attempts: number): void;
  /** Checked between batches. Returning true abandons the solve. */
  cancelled?(): boolean;
}

/** Thrown when `cancelled()` asks the solve to stop, so callers can tell it from a failure. */
export class PublishCancelled extends Error {
  constructor() {
    super('Submission cancelled');
  }
}

/**
 * Finds a nonce satisfying the challenge, yielding between batches.
 *
 * Both hooks exist because of how long this can take: a button that sits there for 19 seconds
 * looks broken, and one that cannot be called off is worse.
 */
export async function solveChallenge(
  challenge: Challenge,
  hooks: SolveHooks = {},
): Promise<string> {
  const target = Buffer.from(challenge.target, 'hex');
  if (target.length !== 32) {
    throw new Error('LRCLIB sent a target that is not a 32-byte hash');
  }
  let nonce = 0;
  while (nonce < MAX_ATTEMPTS) {
    const until = nonce + BATCH_SIZE;
    for (; nonce < until; nonce++) {
      if (meetsTarget(hashAttempt(challenge.prefix, nonce), target)) {
        return String(nonce);
      }
    }
    if (hooks.cancelled && hooks.cancelled()) {
      throw new PublishCancelled();
    }
    if (hooks.onProgress) {
      hooks.onProgress(nonce);
    }
    // hand the thread back so the window keeps painting and stays clickable
    await delay(0);
  }
  throw new Error('Could not solve the LRCLIB challenge');
}

export async function requestChallenge(): Promise<Challenge> {
  const res = await fetch(`${API_BASE}/request-challenge`, {
    headers: {'User-Agent': USER_AGENT},
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`LRCLIB would not issue a challenge: ${res.status}`);
  }
  const body = await res.json() as {prefix?: string; target?: string};
  if (!body.prefix || !body.target) {
    throw new Error('LRCLIB sent a challenge with no prefix or target');
  }
  return {prefix: body.prefix, target: body.target};
}

export interface PublishTrack {
  title: string;
  artist: string;
  album: string;
  /** Milliseconds, as the library stores it; sent to the API in seconds. */
  durationMs: number;
}

/** A token is single-use, so one is solved per submission rather than cached. */
async function publishToken(hooks: SolveHooks): Promise<string> {
  const challenge = await requestChallenge();
  const nonce = await solveChallenge(challenge, hooks);
  return `${challenge.prefix}:${nonce}`;
}

function trackFields(track: PublishTrack): Record<string, unknown> {
  return {
    albumName: track.album,
    artistName: track.artist,
    duration: Math.round(track.durationMs / 1000),
    trackName: track.title,
  };
}

async function post(path: string, payload: Record<string, unknown>,
                    hooks: SolveHooks): Promise<void> {
  const token = await publishToken(hooks);
  const res = await fetch(`${API_BASE}${path}`, {
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
      'X-Publish-Token': token,
    },
    method: 'POST',
  });
  if (res.status === 201 || res.ok) {
    return;
  }
  // the API answers a bad token with JSON naming it; anything else is worth showing raw
  let detail = `${res.status}`;
  try {
    const err = await res.json() as {message?: string};
    if (err && err.message) {
      detail = err.message;
    }
  } catch (parseErr) {
    // not JSON; the status is all there is to report
  }
  throw new Error(`LRCLIB rejected the submission: ${detail}`);
}

/**
 * Sends corrected lyrics upstream.
 *
 * Which field the text goes in is decided by whether it carries timestamps: posting synced LRC
 * as `plainLyrics` would publish the `[mm:ss]` tags as if they were words.
 */
export function publishLyrics(track: PublishTrack, text: string, synced: boolean,
                              hooks: SolveHooks = {}): Promise<void> {
  const payload = trackFields(track);
  if (synced) {
    payload.syncedLyrics = text;
  } else {
    payload.plainLyrics = text;
  }
  return post('/publish', payload, hooks);
}

/** Reports the currently published lyrics as wrong, without offering a replacement. */
export function flagLyrics(track: PublishTrack, hooks: SolveHooks = {}): Promise<void> {
  return post('/flag', trackFields(track), hooks);
}
