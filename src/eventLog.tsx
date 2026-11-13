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

let cached: {mtimeMs: number; size: number; entries: PlayEntry[]} | undefined;

/**
 * The log, re-read only when the file has changed.
 *
 * For the DJ, which may ask more than once in a turn: the file is append-only and grows
 * forever, so parsing it per call would get slower every month. Keyed on mtime **and** size,
 * because two appends inside the same millisecond would otherwise look like no change.
 */
export function readPlaysCached(): PlayEntry[] {
  let stat: {mtimeMs: number; size: number};
  try {
    stat = fs.statSync(LOG_FILE());
  } catch (err) {
    return [];
  }
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached.entries;
  }
  const entries = readPlays();
  cached = {entries, mtimeMs: stat.mtimeMs, size: stat.size};
  return entries;
}

/** Every logged event, in the order written. Returns nothing when there is no log yet. */
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

/**
 * Entries about albums rather than tracks.
 *
 * Skipping the rest of a record is a verdict on the record, so it is logged against the album
 * — which also keeps it out of the per-track helpers below, since they key on `id` and an album
 * id in the track rates would describe a track that does not exist.
 */
export function aboutAlbums(entries: PlayEntry[]): PlayEntry[] {
  return entries.filter((entry) => entry.subject === 'album');
}

/** Entries about tracks, which is everything that does not say otherwise. */
export function aboutTracks(entries: PlayEntry[]): PlayEntry[] {
  return entries.filter((entry) => entry.subject !== 'album');
}

/** How many times each album id appears, for "most skipped albums". */
export function countsById(entries: PlayEntry[]): Record<string, number> {
  return entries.reduce((byId, entry) => {
    byId[entry.id] = (byId[entry.id] || 0) + entry.count;
    return byId;
  }, {} as Record<string, number>);
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

/**
 * Tracks played in the window that had not been played before it.
 *
 * "What did I actually discover" — which `playCount` cannot answer, since it is a total with no
 * sense of when any of it happened. A track counts as new to the window if every logged play of
 * it falls inside it.
 */
export function firstHeardIn(entries: PlayEntry[], window: PlayEntry[]): string[] {
  const earliest = {} as Record<string, number>;
  onlyPlays(entries).forEach((entry) => {
    if (earliest[entry.id] === undefined || entry.at < earliest[entry.id]) {
      earliest[entry.id] = entry.at;
    }
  });
  const start = window.reduce((lowest, entry) => Math.min(lowest, entry.at), Infinity);
  return Object.keys(earliest).filter((id) => earliest[id] >= start);
}

/**
 * The share of encounters that ended in a skip, per track.
 *
 * `skipCount / (skipCount + playCount)` on the track says the same thing, but those totals
 * include everything imported from iTunes years ago. This is the ratio for the period the log
 * covers, which is the one that reflects how the listener feels now.
 */
export function skipRate(entries: PlayEntry[]): Record<string, {plays: number; skips: number}> {
  const byTrack = {} as Record<string, {plays: number; skips: number}>;
  entries.forEach((entry) => {
    if (entry.type !== 'play' && entry.type !== 'skip') {
      return;
    }
    // an album skip is not a track skip; its id is an album's
    if (entry.subject === 'album') {
      return;
    }
    const row = byTrack[entry.id] || {plays: 0, skips: 0};
    if (entry.type === 'play') {
      row.plays += entry.count;
    } else {
      row.skips += entry.count;
    }
    byTrack[entry.id] = row;
  });
  return byTrack;
}

/**
 * How finely to bucket a window of `days` for a column chart.
 *
 * A day per column stops working somewhere past a month — 365 columns in the width this chart
 * gets is a grey smear — so a long range is grouped instead. The thresholds are about what
 * stays readable at roughly 30-50 columns, not about anything in the data.
 */
export type Bucket = 'day' | 'week' | 'month';

export function bucketFor(days: number): Bucket {
  if (days <= 35) {
    return 'day';
  }
  if (days <= 180) {
    return 'week';
  }
  return 'month';
}

/** Local midnight of the day `at` falls in. */
function startOfDay(at: number): Date {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** The start of the bucket `at` belongs to — Monday for a week, the 1st for a month. */
export function bucketStart(at: number, unit: Bucket): number {
  const date = startOfDay(at);
  if (unit === 'week') {
    // Monday, because a listening week reads better than one split across a weekend
    const weekday = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - weekday);
  } else if (unit === 'month') {
    date.setDate(1);
  }
  return date.getTime();
}

/** The next bucket along, which is how the chart walks a window without arithmetic on days. */
export function nextBucket(at: number, unit: Bucket): number {
  const date = new Date(at);
  if (unit === 'day') {
    date.setDate(date.getDate() + 1);
  } else if (unit === 'week') {
    date.setDate(date.getDate() + 7);
  } else {
    date.setMonth(date.getMonth() + 1);
  }
  return date.getTime();
}

/**
 * Plays per bucket across a window, including the empty ones.
 *
 * Empty buckets are kept because a gap is information — a week with no listening says
 * something, and dropping it would quietly compress the timeline.
 */
export function playsByBucket(entries: PlayEntry[], days: number,
                              now: number = Date.now()): Array<{at: number; value: number}> {
  const unit = bucketFor(days);
  const windowed = since(onlyPlays(entries), days, now);
  const counts = {} as Record<number, number>;
  windowed.forEach((entry) => {
    const key = bucketStart(entry.at, unit);
    counts[key] = (counts[key] || 0) + entry.count;
  });
  const firstDay = startOfDay(now).getTime() - (days - 1) * 86400000;
  const out: Array<{at: number; value: number}> = [];
  let at = bucketStart(firstDay, unit);
  const last = bucketStart(now, unit);
  // bounded in case a bad unit would otherwise loop forever
  for (let guard = 0; at <= last && guard < 1000; guard++) {
    out.push({at, value: counts[at] || 0});
    at = nextBucket(at, unit);
  }
  return out;
}

/** The whole span the log covers, in days, for an "all time" range. */
export function spanInDays(entries: PlayEntry[], now: number = Date.now()): number {
  if (!entries.length) {
    return 1;
  }
  const earliest = entries.reduce((lowest, entry) => Math.min(lowest, entry.at), Infinity);
  const days = Math.ceil((startOfDay(now).getTime() - startOfDay(earliest).getTime()) / 86400000);
  return Math.max(1, days + 1);
}

/** Plays per weekday, Sunday first, for "when do I actually listen". */
export function playsByWeekday(entries: PlayEntry[]): number[] {
  const days = new Array(7).fill(0) as number[];
  onlyPlays(entries).forEach((entry) => {
    if (!entry.estimated) {
      days[new Date(entry.at).getDay()] += entry.count;
    }
  });
  return days;
}

/** How many separate days in the window had any listening at all. */
export function activeDays(entries: PlayEntry[]): number {
  return Object.keys(playsByDay(onlyPlays(entries))).length;
}

/** The entries from the last `days` days, counting today, by local midnight boundaries. */
export function since(entries: PlayEntry[], days: number, now: number = Date.now()): PlayEntry[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const cutoff = start.getTime() - (days - 1) * 86400000;
  return entries.filter((entry) => entry.at >= cutoff);
}
