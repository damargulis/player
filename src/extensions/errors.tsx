
/**
 * Errors shared by all metadata extensions. An error means no extension has
 * been able to fill in that piece of data -- any extension that finds it
 * clears the error, whichever extension originally added it.
 */
export enum ExtensionError {
  ALBUM_ART = 'No album art found.',
  GENRE = 'No genres found.',
  LOOKUP = 'Lookup failed.',
  NO_MATCH = 'No match found.',
  PARSER = 'Parser error.',
  PIC = 'No picture found.',
  TRACK = 'Wrong number of tracks found.',
  YEAR = 'No year found.',
}

interface Errorable {
  errors: string[];
}

/**
 * The sources whose word counts for "nothing could find this".
 *
 * The iTunes import is deliberately not one of them. It supplies a genre for most tracks, so an
 * error derived from whether `genreIds` is populated — the way `ALBUM_ART` is derived from
 * whether a file exists — would almost never fire, and the thing being asked is not "does this
 * album have a genre" but "has anything that actually knows looked it up".
 */
export enum MetaSource {
  MUSICBRAINZ = 'musicbrainz',
  WIKIPEDIA = 'wikipedia',
}

/**
 * What each real source last found. Absent means nothing has reported yet.
 *
 * The two fields are deliberately different shapes, because the questions are. Genres are a
 * set and the album's genres are the *union* of what the sources say, so each source's answer
 * has to be kept separately — the whole point is that neither replaces the other. A year is a
 * single number with nothing to merge: two sources disagreeing needs a winner, not a union, so
 * recording which ones found one is enough.
 */
export interface MetaSources {
  genres?: Partial<Record<MetaSource, string[]>>;
  year?: string[];
}

interface Sourced extends Errorable {
  metaSources?: MetaSources;
}

/** Union order, so the genres of an album read the same whichever extension ran last. */
const SOURCE_ORDER: MetaSource[] = [MetaSource.MUSICBRAINZ, MetaSource.WIKIPEDIA];

export function removeError(item: Errorable, err: string): void {
  const index = item.errors.indexOf(err);
  if (index >= 0) {
    item.errors = [
      ...item.errors.slice(0, index),
      ...item.errors.slice(index + 1),
    ];
  }
}

export function addError(item: Errorable, err: string): void {
  if (!item.errors.includes(err)) {
    item.errors.push(err);
  }
}

/**
 * Keeps a "missing X" error in step with whether X is actually there.
 *
 * `ALBUM_ART` and `PIC` describe a fact about the entity — it has a picture or it does not —
 * but they were recorded as "a download failed", which is a different thing and drifts from
 * the truth in both directions. In this library 257 of the 267 albums flagged "No album art
 * found" had art, while 34 albums with none were flagged with nothing; artists were wrong 56
 * and 78 ways respectively. A fetch failing when the entity already has a picture is not a
 * missing picture, and a successful fetch is not the only way to come to have one.
 *
 * So these two are treated as derived rather than reported: both the extensions and
 * `loadLibrary` put them through here, which makes a stale flag correct itself on next launch.
 */
export function setError(item: Errorable, err: string, missing: boolean): void {
  if (missing) {
    addError(item, err);
  } else {
    removeError(item, err);
  }
}

/** The same rule for a fresh array, which is what the load path builds. */
export function withError(errors: string[], err: string, missing: boolean): string[] {
  const without = errors.filter((existing) => existing !== err);
  return missing ? without.concat([err]) : without;
}

/**
 * Records which sources found a year, and re-derives `YEAR` from all of them.
 *
 * `GENRE` and `YEAR` were written the way `ALBUM_ART` used to be — each extension added the
 * error on failure and removed it on success — so the extension that ran *last* decided, and
 * MusicBrainz runs before Wikipedia. A page whose infobox has no year row therefore erased a
 * perfectly good MusicBrainz answer: all 5 albums flagged "No year found" in this library have
 * a year, and 57 of the 82 flagged "No genres found" have genres.
 *
 * Art could be fixed by deriving the error from the file on disk, because having a picture is a
 * fact about the album. Neither of these is: the iTunes import writes both, and an imported
 * value is not one a source stands behind. So the provenance is what gets stored, and the error
 * is "every source that has reported came up empty" — which makes "either of them found it"
 * fall out without the two extensions having to know about each other.
 *
 * Only call this when a source actually answered. A failed lookup is not a statement about the
 * data, and recording one would bring back the same drift in a new place.
 */
export function recordYear(item: Sourced, source: MetaSource, found: boolean): void {
  const sources = Object.assign({}, item.metaSources) as MetaSources;
  const previous = sources.year || [];
  sources.year = found
    ? (previous.indexOf(source) >= 0 ? previous : previous.concat([source]))
    : previous.filter((name) => name !== source);
  item.metaSources = sources;
  setError(item, ExtensionError.YEAR, sources.year.length === 0);
}

/**
 * Records the genres one source found, and returns the union across every source.
 *
 * A union rather than a replacement because the two sources are describing the same record
 * from different angles and are both right: MusicBrainz gives the community's tags for the
 * release group, Wikipedia gives whatever the infobox editor wrote. Replacing meant the answer
 * depended on run order, and the order is fixed (MusicBrainz, then Wikipedia), so Wikipedia
 * always won — including when it had nothing to say.
 *
 * Names are stored rather than genre ids because they are the source's actual answer; ids are
 * our own interning, and `loadLibrary` deletes ones nothing points at. Deduplicated without
 * regard to case so the two spellings of an acronym ("R&B" and "R&b", of which this library
 * has five pairs) do not both survive, keeping whichever was seen first.
 */
export function recordGenres(item: Sourced, source: MetaSource, found: string[]): string[] {
  const sources = Object.assign({}, item.metaSources) as MetaSources;
  sources.genres = Object.assign({}, sources.genres, {[source]: found});
  item.metaSources = sources;
  const union = unionGenres(sources.genres);
  setError(item, ExtensionError.GENRE, union.length === 0);
  return union;
}

/** Every source's genres in a fixed order, deduplicated case-insensitively. */
export function unionGenres(genres?: Partial<Record<MetaSource, string[]>>): string[] {
  const seen = {} as Record<string, boolean>;
  return SOURCE_ORDER.reduce((all, source) => {
    return all.concat((genres && genres[source]) || []);
  }, [] as string[]).filter((genre) => {
    const key = genre.trim().toLowerCase();
    if (!key || seen[key]) {
      return false;
    }
    seen[key] = true;
    return true;
  });
}

/**
 * The load-path twin, which repairs a stale flag at launch the way `withError` does for art.
 *
 * A field no source has reported on is left exactly as stored rather than asserted either way:
 * before the first run there is no provenance to go on, and dropping a flag that happens to be
 * right would lose something the listener asked to see. A stale one corrects itself the next
 * time any extension touches that album.
 */
export function withSourceErrors(errors: string[], sources?: MetaSources): string[] {
  const year = sources && sources.year;
  const genres = sources && sources.genres;
  const withYear = year ? withError(errors, ExtensionError.YEAR, year.length === 0) : errors;
  return genres
    ? withError(withYear, ExtensionError.GENRE, unionGenres(genres).length === 0)
    : withYear;
}

// Errors written by older versions were prefixed per extension; map them onto
// the shared errors so they can still be cleared.
const LEGACY_PREFIXES = ['Wikipedia Modifier: ', 'MusicBrainz Modifier: '];
const LEGACY_ERRORS: Record<string, ExtensionError> = {
  'Lookup failed.': ExtensionError.LOOKUP,
  'No album art found.': ExtensionError.ALBUM_ART,
  'No genres found.': ExtensionError.GENRE,
  'No match found.': ExtensionError.NO_MATCH,
  'No page found.': ExtensionError.NO_MATCH,
  'No picture found.': ExtensionError.PIC,
  'No year found.': ExtensionError.YEAR,
  'Parser error.': ExtensionError.PARSER,
  'Wrong number of tracks found.': ExtensionError.TRACK,
};

export function migrateLegacyErrors(errors?: string[]): string[] {
  const migrated = (errors || []).map((error) => {
    const prefix = LEGACY_PREFIXES.find((legacyPrefix) => error.startsWith(legacyPrefix));
    if (!prefix) {
      return error;
    }
    return LEGACY_ERRORS[error.slice(prefix.length)] || error;
  });
  return migrated.filter((error, index) => migrated.indexOf(error) === index);
}
