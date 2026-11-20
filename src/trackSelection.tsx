import {Track} from './redux/actionTypes';

/**
 * The tracks a list selection refers to, resolved **before** anything acts on them.
 *
 * A selection is row indexes into the list as it is sorted now. Acting row by row re-reads the
 * list between steps, and each delete re-renders it — on an album or playlist page that rebuilds
 * and re-sorts the rows, so the remaining indexes point at different tracks. Selecting rows 2 and 3
 * deleted 2 and 4, and selecting the last two rows crashed on a row that no longer existed.
 */
export function resolveSelection(tracks: Track[], selected: number[]): Track[] {
  const seen = new Set<string>();
  return selected
    .map((index) => tracks[index])
    .filter((track): track is Track => {
      if (!track || seen.has(track.id)) {
        return false;
      }
      seen.add(track.id);
      return true;
    });
}

/** The confirmation's detail line: a few names, so it is clear *which* tracks are going. */
export function describeTracks(tracks: Track[], shown: number = 5): string {
  const names = tracks.slice(0, shown).map((track) => `“${track.name}”`);
  const more = tracks.length - shown;
  return more > 0 ? `${names.join(', ')} and ${more} more` : names.join(', ');
}
