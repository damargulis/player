import {Album, AlbumInfo, Artist, ArtistInfo, Genre, LibraryInfo, Track, TrackInfo} from '../redux/actionTypes';

/** The fields the MusicBrainz and Wikipedia extensions write. Nothing else of theirs is sent. */
export const ALBUM_FIELDS: Array<keyof Album> =
  ['albumArtFile', 'coverArt', 'errors', 'genreIds', 'mbid', 'metaSources', 'wikiPage', 'year'];
export const ARTIST_FIELDS: Array<keyof Artist> = ['artFile', 'errors', 'genreIds', 'mbid', 'metaSources', 'wikiPage'];
export const TRACK_FIELDS: Array<keyof Track> = ['genreIds', 'mbid', 'warning', 'year'];

/** JSON.stringify turns `undefined` into nothing; a field that became unset must still differ. */
const UNSET = '\u0000unset';

function serialise(value: unknown): string {
  return value === undefined ? UNSET : JSON.stringify(value);
}

type Snapshot = Record<string, Record<string, string>>;

/**
 * What an extension run starts from, so its result can be just what it changed.
 *
 * The extensions modify entities in place and used to send back whole objects — every track in
 * the library, the playlists, every genre — as they were when the run *started*. The reducer
 * spreads an update over the live entity, so a run of several hours rolled back everything that
 * happened meanwhile: each play count and play date, skips, favourites, playlist edits, deleted
 * tracks (back again), removed art (back again). Serialised copies, because the extensions also
 * mutate nested objects such as `warning` in place.
 */
export interface RunStart {
  albums: Snapshot;
  artists: Snapshot;
  tracks: Snapshot;
  genreIds: Set<string>;
}

function capture<T extends {id: string}>(entities: T[], fields: Array<keyof T>): Snapshot {
  const out: Snapshot = {};
  entities.forEach((entity) => {
    const fieldsOf: Record<string, string> = {};
    fields.forEach((field) => {
      fieldsOf[field as string] = serialise(entity[field]);
    });
    out[entity.id] = fieldsOf;
  });
  return out;
}

function changed<T extends {id: string}, I>(
  entities: T[], fields: Array<keyof T>, before: Snapshot,
): Record<string, I> {
  const out: Record<string, I> = {};
  entities.forEach((entity) => {
    const was = before[entity.id] || {};
    const delta: Record<string, unknown> = {};
    fields.forEach((field) => {
      if (serialise(entity[field]) !== was[field as string]) {
        delta[field as string] = entity[field];
      }
    });
    if (Object.keys(delta).length) {
      out[entity.id] = delta as unknown as I;
    }
  });
  return out;
}

export function startRun(albums: Album[], artists: Artist[], tracks: Track[], genres: Record<string, Genre>): RunStart {
  return {
    albums: capture(albums, ALBUM_FIELDS),
    artists: capture(artists, ARTIST_FIELDS),
    genreIds: new Set(Object.keys(genres)),
    tracks: capture(tracks, TRACK_FIELDS),
  };
}

/** Only the fields that changed, on only the entities the run was given, plus any new genres. */
export function runDelta(start: RunStart, albums: Album[], artists: Artist[], tracks: Track[],
                         genres: Record<string, Genre>): LibraryInfo {
  const newGenres: Record<string, Genre> = {};
  Object.keys(genres).forEach((id) => {
    if (!start.genreIds.has(id)) {
      newGenres[id] = genres[id];
    }
  });
  return {
    albums: changed<Album, AlbumInfo>(albums, ALBUM_FIELDS, start.albums),
    artists: changed<Artist, ArtistInfo>(artists, ARTIST_FIELDS, start.artists),
    genres: newGenres,
    tracks: changed<Track, TrackInfo>(tracks, TRACK_FIELDS, start.tracks),
  };
}
