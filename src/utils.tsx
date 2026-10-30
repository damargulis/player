import fs from 'fs';
import path from 'path';

function capitalize(word: string): string {
  if (word === 'and') {
    return word;
  }
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function formatGenre(genre: string): string {
  const genreString = genre.trim().split(' ').map(
    (word) => capitalize(word)).join(' ');
  return genreString.split('-').map((word) => capitalize(word)).join('-');
}

export function getImgSrc(fileName: string): string {
  if (!fileName) {
    return '';
  }
  const url = new URL('file://' + path.resolve(fileName));
  try {
    // Cache-buster: extensions overwrite art files in place, and Chromium
    // caches images by URL, so a bare file:// URL keeps showing the old bytes.
    url.search = `m=${Math.round(fs.statSync(path.resolve(fileName)).mtimeMs)}`;
  } catch (err) {
    // file missing or fs unavailable; plain URL is fine
  }
  return url.toString();
}

interface Nameable {
  name: string;
}

export function inverse<T extends Nameable>(record: Record<string, T>): Record<string, string> {
  const ret = {} as Record<string, string>;
  Object.keys(record).forEach((key) => {
    const newKey = record[key];
    ret[newKey.name] = key;
  });
  return ret;
}

/**
 * Formats a duration to a time "minutes:seconds".
 * Takes in time in milliseconds.
 */
export function toTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / (60 * 60));
  const minutes = (Math.floor(totalSeconds / 60)) % 60;
  const seconds = totalSeconds % 60;
  let secondsString = `${seconds}`;
  if (seconds < 10) {
    secondsString = '0' + seconds;
  }
  const minutesString = (hours && minutes < 10) ? `0${minutes}` : minutes;
  return `${hours ? hours + ':' : ''}${minutesString}:${secondsString}`;
}

/** The calendar day an ISO date falls on, as YYYY-MM-DD. */
export function dayKey(isoDate: string): string {
  return isoDate.slice(0, 10);
}

/**
 * Parses an ISO date in local time.
 *
 * Reach for this instead of `new Date(string)` whenever the value might be date-only. The
 * built-in parser reads "2027-01-14" as UTC midnight, which is the 13th anywhere west of
 * Greenwich, so a date with no time silently lands on the wrong day. Building from the parts
 * avoids the conversion entirely, which is what you want for dates that are already local to
 * wherever they describe — a venue's listing, a release date — rather than instants in time.
 */
export function localDate(isoDate: string): Date {
  const [year, month, day] = dayKey(isoDate).split('-').map(Number);
  const time = isoDate.slice(11, 16);
  const [hours, minutes] = time ? time.split(':').map(Number) : [0, 0];
  return new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0);
}

/**
 * A wall-clock time for a transcript entry, in the viewer's own locale.
 *
 * Hour and minute only: seconds are noise in a conversation, and the date is carried by the
 * session itself. Duplicated in `public/dj-web/index.html` and `DJChatScreen.kt` — the three
 * clients render the same transcript and should agree, as with the speaker colours.
 */
export function clockTime(at?: number): string {
  if (!at) {
    return '';
  }
  return new Date(at).toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'});
}
