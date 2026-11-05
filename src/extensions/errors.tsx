
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
