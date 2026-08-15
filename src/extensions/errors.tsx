
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
