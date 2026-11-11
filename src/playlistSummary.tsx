import {Playlist} from './redux/actionTypes';
import {getAlbumsByIds, getArtistsByIds, getTracksByIds} from './redux/selectors';
import {RootState} from './redux/store';

/**
 * The facts that give a playlist a face.
 *
 * A playlist is `{name, trackIds}` and nothing else, so the picker had only a name to show —
 * which is why it looked like a borrowed album grid with the pictures missing. Everything here
 * is derived from the tracks it already points at.
 */

export interface PlaylistSummary {
  trackCount: number;
  durationMs: number;
  /** The most frequent artists, which is what makes a playlist recognisable without art. */
  topArtists: string[];
  /** Covers of its most common albums, for the mosaic. */
  artFiles: string[];
}

const TOP_ARTISTS = 3;
/** A 2x2 mosaic; a playlist with fewer distinct covers shows one large instead. */
export const MOSAIC_TILES = 4;

/**
 * Cached per playlist object.
 *
 * "Favorite Albums Pre-2017" is 3,106 tracks and there are fourteen manual playlists plus a
 * dozen generated ones, so this is real work — and `PlaylistPicker`'s `mapStateToProps` builds
 * fresh arrays, so it re-renders on every redux action. A WeakMap keyed on the playlist means
 * the work happens once per playlist per library change and the entry is collected with it.
 */
const cache = new WeakMap<Playlist, PlaylistSummary>();

function byFrequency(counts: Record<string, number>): string[] {
  return Object.keys(counts).sort((one, two) => counts[two] - counts[one]);
}

export function summarise(state: RootState, playlist: Playlist): PlaylistSummary {
  const existing = cache.get(playlist);
  if (existing) {
    return existing;
  }
  const tracks = getTracksByIds(state, playlist.trackIds || []).filter(Boolean);
  const artistCounts = {} as Record<string, number>;
  const albumCounts = {} as Record<string, number>;
  let durationMs = 0;
  tracks.forEach((track) => {
    durationMs += track.duration || 0;
    getArtistsByIds(state, track.artistIds || []).forEach((artist) => {
      if (artist) {
        artistCounts[artist.name] = (artistCounts[artist.name] || 0) + 1;
      }
    });
    (track.albumIds || []).forEach((id) => {
      albumCounts[id] = (albumCounts[id] || 0) + 1;
    });
  });
  // the most-represented albums, so the mosaic shows what the playlist is mostly made of
  const artFiles = getAlbumsByIds(state, byFrequency(albumCounts))
    .filter((album) => album && album.albumArtFile)
    .map((album) => album.albumArtFile as string)
    .slice(0, MOSAIC_TILES);
  const summary = {
    artFiles,
    durationMs,
    topArtists: byFrequency(artistCounts).slice(0, TOP_ARTISTS),
    trackCount: tracks.length,
  };
  cache.set(playlist, summary);
  return summary;
}

/** "12h 35m", "47m", or "empty" — compact enough for a row. */
export function describeLength(summary: PlaylistSummary): string {
  if (!summary.trackCount) {
    return 'empty';
  }
  const tracks = `${summary.trackCount.toLocaleString()} track${summary.trackCount === 1 ? '' : 's'}`;
  const minutes = Math.round(summary.durationMs / 60000);
  const hours = Math.floor(minutes / 60);
  const length = hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
  return `${tracks} · ${length}`;
}
