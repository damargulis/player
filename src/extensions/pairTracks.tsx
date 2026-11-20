import {Track} from '../redux/actionTypes';
import {nameKey} from '../utils';

/** "Song (Remastered 2011)", "Song [Live]", "Song - Single Version" → "Song". */
function withoutQualifier(title: string): string {
  return title.replace(/\s*[(\[][^)\]]*[)\]]\s*$/, '').replace(/\s+-\s+.*$/, '');
}

/**
 * Pairs the album's tracks with a source's tracklist: `result[i]` is the entry for `local[i]`.
 *
 * By title first, position only for what is left. Pairing purely by position gave about half of
 * every multi-disc album another song's genres, year and name hint: `album.trackIds` is sorted
 * by track number alone (disc 1 track 1, disc 2 track 1, disc 1 track 2…) while MusicBrainz and
 * Wikipedia list disc 1 then disc 2, and with the counts equal nothing looked wrong.
 *
 * Exact folded titles are matched first, then titles with a trailing qualifier dropped; each
 * entry is used once, so two songs with one name still take one entry each. Whatever has no
 * title match — a track renamed locally — takes the remaining entries in order, which is what a
 * single-disc album with an odd title needs. Callers only pair lists of the same length.
 */
export function pairTracks<T>(local: Track[], remote: T[], titleOf: (entry: T) => string): Array<T | undefined> {
  const result: Array<T | undefined> = local.map(() => undefined);
  const used = remote.map(() => false);
  const pass = (key: (title: string) => string): void => {
    const byKey = new Map<string, number[]>();
    remote.forEach((entry, i) => {
      if (!used[i]) {
        const k = key(titleOf(entry));
        byKey.set(k, (byKey.get(k) || []).concat([i]));
      }
    });
    local.forEach((track, i) => {
      if (result[i] !== undefined) {
        return;
      }
      const candidates = byKey.get(key(track.name)) || [];
      const index = candidates.find((candidate) => !used[candidate]);
      if (index !== undefined) {
        used[index] = true;
        result[i] = remote[index];
      }
    });
  };
  pass((title) => nameKey(title));
  pass((title) => nameKey(withoutQualifier(title)));
  const leftovers = remote.filter((entry, i) => !used[i]);
  local.forEach((track, i) => {
    if (result[i] === undefined) {
      result[i] = leftovers.shift();
    }
  });
  return result;
}
