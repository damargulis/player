import {Artist, Track, TrackInfo, TrackWarning} from './redux/actionTypes';

export interface WarningPlan {
  /** Featured artists the library does not have yet, with every track that names them. */
  newArtists: Array<{id: string; name: string; trackIds: string[]}>;
  trackUpdates: Array<{id: string; info: TrackInfo}>;
}

/**
 * What accepting an album's track hints changes.
 *
 * A hint only ever *adds*: a title to adopt, featured artists to credit. Accepting used to set
 * every hinted track's artists to the **album's** plus the featured ones — on a compilation that
 * replaced each track's real artist with "Various Artists", and it did so even for a hint that
 * was only about the title. A track's own artists are now kept and the featured ones added.
 * A new featured artist used to be linked to the first track that named them and no other.
 *
 * Positional, like the warnings themselves: `warnings[n]` is about `trackIds[n]`.
 */
export function planWarningAcceptance(
  trackIds: string[],
  warnings: TrackWarning[],
  getTrack: (id: string) => Track | undefined,
  getArtistByName: (name: string) => Artist | undefined,
  makeId: () => string,
): WarningPlan {
  const created = new Map<string, {id: string; name: string; trackIds: string[]}>();
  const trackUpdates: Array<{id: string; info: TrackInfo}> = [];
  warnings.forEach((warning, index) => {
    const track = getTrack(trackIds[index]);
    if (!track || !warning || Object.keys(warning).length === 0) {
      return;
    }
    const info: TrackInfo = {warning: undefined};
    if (warning.name) {
      info.name = warning.name;
    }
    const featured = (warning.featuring || []).map((name) => {
      const existing = getArtistByName(name);
      if (existing) {
        return existing.id;
      }
      let entry = created.get(name);
      if (!entry) {
        entry = {id: makeId(), name, trackIds: []};
        created.set(name, entry);
      }
      entry.trackIds.push(track.id);
      return entry.id;
    });
    if (featured.length) {
      info.artistIds = track.artistIds.concat(featured.filter((id) => track.artistIds.indexOf(id) < 0));
    }
    trackUpdates.push({id: track.id, info});
  });
  return {newArtists: Array.from(created.values()), trackUpdates};
}
