import {DATA_DIR} from '../../constants';
import fs from 'fs';
import path from 'path';

/**
 * Lyrics on disk, one file per track.
 *
 * Deliberately not in `library.json`: at a few KB of LRC each, the whole library would add
 * 40-80MB to a file that is parsed at launch, rewritten on every library update, and uploaded
 * to GCS daily. Album art is kept out for the same reason, and like art these are re-fetchable,
 * so leaving them out of the backup costs nothing but a re-run.
 *
 * Synced lyrics are stored as LRC even though nothing highlights them yet, so adding that later
 * needs no second pass over the API.
 */

const LYRICS_DIR = () => `${DATA_DIR}/lyrics`;

/** Track ids are shortids, but this is what stops a crafted id escaping the directory. */
export function lyricsPath(trackId: string): string {
  return path.join(LYRICS_DIR(), `${path.basename(trackId)}.lrc`);
}

export function saveLyrics(trackId: string, text: string): void {
  const dir = LYRICS_DIR();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {recursive: true});
  }
  fs.writeFileSync(lyricsPath(trackId), text, 'utf8');
}

/** The stored text, or undefined when nothing has been fetched for this track. */
export function readLyrics(trackId: string): string | undefined {
  try {
    return fs.readFileSync(lyricsPath(trackId), 'utf8');
  } catch (err) {
    return undefined;
  }
}

export function hasLyricsFile(trackId: string): boolean {
  return fs.existsSync(lyricsPath(trackId));
}

export interface LyricLine {
  /** Milliseconds from the start of the track, or undefined on an unsynced line. */
  at?: number;
  text: string;
}

const LRC_LINE = /^\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]\s?(.*)$/;

/**
 * Parses LRC into lines, falling back to plain text.
 *
 * Handles both `[mm:ss.xx]` and `[mm:ss:xx]`, and two- or three-digit fractions, because LRC in
 * the wild uses all of them. Metadata tags like `[ar:...]` are dropped: the minute group only
 * matches digits, so they fail the pattern and are skipped as empty.
 */
export function parseLyrics(text: string): LyricLine[] {
  const lines: LyricLine[] = [];
  text.split(/\r?\n/).forEach((raw) => {
    const match = LRC_LINE.exec(raw);
    if (!match) {
      // An unsynced file is just text; a metadata tag yields nothing useful either way.
      if (!/^\[[a-z]+:/i.test(raw)) {
        lines.push({text: raw});
      }
      return;
    }
    const [, minutes, seconds, fraction, content] = match;
    const frac = fraction ? Number(fraction.padEnd(3, '0')) : 0;
    lines.push({
      at: Number(minutes) * 60000 + Number(seconds) * 1000 + frac,
      text: content,
    });
  });
  // Trailing blank lines are noise in a popup; interior ones are deliberate spacing.
  while (lines.length && !lines[lines.length - 1].text.trim() && lines[lines.length - 1].at === undefined) {
    lines.pop();
  }
  return lines;
}

/** True when the stored text carries timestamps, i.e. the dimmed-vs-solid L. */
export function isSynced(text: string): boolean {
  return parseLyrics(text).some((line) => line.at !== undefined);
}
