import {DATA_DIR} from './constants';
import fs from 'fs';

/**
 * An append-only log of what was done to the library, one line per event.
 *
 * `Track.playCount` and `Track.playDate` between them record how many times a song has been
 * played and when it was played **last** — so the listening history is one date per song and
 * nothing more. "What did I listen to in March", "what have I rediscovered", and any view of
 * listening over time are all unanswerable from it, and the DJ has to make do with
 * `recentlyPlayedBrief`.
 *
 * Deliberately not in `library.json`: that file is 13MB, parsed at launch, rewritten on every
 * library update and uploaded daily, and a log that grows forever has no business in it. One
 * line per play at ~45 bytes is a few megabytes after years.
 *
 * JSONL rather than JSON so an append is a single write with nothing to re-serialise, and so a
 * line torn by a crash costs that line rather than the file.
 *
 * Plays were the first event and for a while the only one, which is why the file is still
 * called `plays.jsonl` and why a line with no `type` means a play — renaming the file would
 * orphan the history already in it for no gain. Skips, favourites and reactions had the same
 * problem plays did: `Track.skipCount` and `Track.favorites` record a total and a year, so
 * "when did I start skipping this" and "what did I fall for in March" were unanswerable, and
 * un-favouriting left no trace at all.
 *
 * Phone plays carry their **own** timestamp, taken on the phone where it is known —
 * `PlayTracker` records the moment and `/start-sync` sends it. The one exception is plays left
 * over from a build that only kept counts, which have no time to give and are stamped with the
 * sync moment; those are the only entries where `at` is not when the music played, and
 * `estimated` marks them so nothing has to guess.
 */

const LOG_FILE = (): string => `${DATA_DIR}/plays.jsonl`;

export type PlaySource = 'desktop' | 'phone';

/**
 * What happened.
 *
 * Deliberately not everything the app can do: pausing, seeking and volume are moment-to-moment
 * controls rather than opinions about music, and logging them would bury the events that say
 * something. The DJ's queue churn is left out too — `src/dj/activity.tsx` already tracks it
 * for the session it belongs to.
 */
export type EventType = 'play' | 'skip' | 'favorite' | 'unfavorite' | 'react';

/** Which collection the id refers to. Tracks unless stated. */
export type EventSubject = 'track' | 'album';

export interface PlayEntry {
  type: EventType;
  subject: EventSubject;
  /** For a reaction: whose it is, and what it became. */
  who?: string;
  value?: string;
  /** Epoch ms the play happened, unless `estimated`. */
  at: number;
  id: string;
  /** Plays represented by this entry; 1 unless an old phone build sent a bare count. */
  count: number;
  source: PlaySource;
  /** True when `at` is a sync time rather than a play time. */
  estimated: boolean;
}

/** What goes on disk; keys are omitted at their defaults so a normal play is ~45 bytes. */
interface StoredEntry {
  at: number;
  id: string;
  n?: number;
  src?: PlaySource;
  est?: boolean;
  /** Absent means a play, which is what every line written before other events existed is. */
  type?: EventType;
  /** Absent means a track. */
  subject?: EventSubject;
  who?: string;
  value?: string;
}

export function logPath(): string {
  return LOG_FILE();
}

export interface NewPlay {
  id: string;
  at: number;
  count?: number;
  source: PlaySource;
  /** Set when `at` is a sync time rather than a play time. */
  estimated?: boolean;
  /** Defaults to a play, so existing callers are unchanged. */
  type?: EventType;
  subject?: EventSubject;
  who?: string;
  value?: string;
}

/**
 * Appends plays.
 *
 * Synchronous on purpose. These are tens of bytes and happen once every few minutes, so the
 * cost is nothing, and it sidesteps the interleaving that corrupted `library.json` rather than
 * guarding against it. A whole phone sync is batched into one write.
 */
export function logPlays(plays: NewPlay[]): void {
  const lines = plays
    .filter((play) => play.id && play.at > 0 && (play.count === undefined || play.count > 0))
    .map((play) => {
      const entry: StoredEntry = {at: play.at, id: play.id};
      if (play.count !== undefined && play.count !== 1) {
        entry.n = play.count;
      }
      if (play.source !== 'desktop') {
        entry.src = play.source;
      }
      if (play.estimated) {
        entry.est = true;
      }
      // omitted at their defaults, so a play stays the short line it has always been
      if (play.type && play.type !== 'play') {
        entry.type = play.type;
      }
      if (play.subject && play.subject !== 'track') {
        entry.subject = play.subject;
      }
      if (play.who) {
        entry.who = play.who;
      }
      if (play.value) {
        entry.value = play.value;
      }
      return JSON.stringify(entry);
    });
  if (!lines.length) {
    return;
  }
  try {
    fs.appendFileSync(LOG_FILE(), `${lines.join('\n')}\n`, 'utf8');
  } catch (err) {
    // A play log is nice to have, not precious. Losing an entry must never interrupt playback.
  }
}

/** Parses one stored line, or undefined if it is not a usable entry. */
export function parseEntry(line: string): PlayEntry | undefined {
  if (!line.trim()) {
    return undefined;
  }
  let stored: StoredEntry;
  try {
    stored = JSON.parse(line) as StoredEntry;
  } catch (err) {
    // a line torn by a crash, or something that is not ours
    return undefined;
  }
  if (!stored || typeof stored.at !== 'number' || stored.at <= 0 ||
      typeof stored.id !== 'string' || !stored.id) {
    return undefined;
  }
  return {
    at: stored.at,
    count: typeof stored.n === 'number' && stored.n > 0 ? stored.n : 1,
    estimated: stored.est === true,
    id: stored.id,
    source: stored.src === 'phone' ? 'phone' : 'desktop',
    subject: stored.subject === 'album' ? 'album' : 'track',
    // a line with no type predates the other events and is a play
    type: stored.type || 'play',
    value: stored.value,
    who: stored.who,
  };
}

/** Every logged play, in the order written. Returns nothing when there is no log yet. */
export function readPlays(): PlayEntry[] {
  let text: string;
  try {
    text = fs.readFileSync(LOG_FILE(), 'utf8');
  } catch (err) {
    return [];
  }
  return text.split('\n').map(parseEntry).filter(Boolean) as PlayEntry[];
}

/** Just the plays, which is what the listening charts mean. */
export function onlyPlays(entries: PlayEntry[]): PlayEntry[] {
  return entries.filter((entry) => entry.type === 'play');
}

/** Every entry of one type, for counting skips or favourites over time. */
export function ofType(entries: PlayEntry[], type: EventType): PlayEntry[] {
  return entries.filter((entry) => entry.type === type);
}

/** The local day an entry falls in, as `2026-11-05`. */
export function dayOf(at: number): string {
  const date = new Date(at);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-` +
    `${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Plays per local day.
 *
 * Local rather than UTC because a listening history is about the listener's evenings — the same
 * reason `dayKey` exists in `src/utils.tsx`.
 */
export function playsByDay(entries: PlayEntry[]): Record<string, number> {
  return entries.reduce((byDay, entry) => {
    const key = dayOf(entry.at);
    byDay[key] = (byDay[key] || 0) + entry.count;
    return byDay;
  }, {} as Record<string, number>);
}

/**
 * Plays per hour of the day, 0–23.
 *
 * `estimated` entries are left out: their `at` is a sync time, so counting them would pile a
 * day of listening onto whatever hour the phone came home. Only pre-timestamp phone builds
 * produce those, so this empties out as those plays age away.
 */
export function playsByHour(entries: PlayEntry[]): number[] {
  const hours = new Array(24).fill(0) as number[];
  entries.forEach((entry) => {
    if (entry.estimated) {
      return;
    }
    hours[new Date(entry.at).getHours()] += entry.count;
  });
  return hours;
}

/** Total plays per track id, for "what did I actually listen to in this window". */
export function playsByTrack(entries: PlayEntry[]): Record<string, number> {
  return entries.reduce((byTrack, entry) => {
    byTrack[entry.id] = (byTrack[entry.id] || 0) + entry.count;
    return byTrack;
  }, {} as Record<string, number>);
}

/** The entries from the last `days` days, counting today, by local midnight boundaries. */
export function since(entries: PlayEntry[], days: number, now: number = Date.now()): PlayEntry[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const cutoff = start.getTime() - (days - 1) * 86400000;
  return entries.filter((entry) => entry.at >= cutoff);
}
