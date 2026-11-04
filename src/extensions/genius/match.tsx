/**
 * Deciding whether a Genius search hit is the track we asked about.
 *
 * This used to be exact string equality after lowercasing and normalising quotes, and it was
 * the limiting factor on the extension's hit rate, not Genius's catalogue. Measured over a
 * 180-track spread of the tracks the extension had failed to link, the right song was the
 * *first* hit for almost all of them and was being thrown away over a comma: "Paint It Black"
 * vs "Paint It, Black", "3 A.M." vs "3 AM", "Gods Dice" vs "Gods' Dice", "Deja Vu" vs
 * "Déjà Vu", "Sage & Spirit" vs "Sage and Spirit". Only 5 of the 180 returned no hits at all.
 *
 * The rules below took that sample from 49% to 76%. Each one was added only after seeing it
 * recover real tracks, and every newly accepted link in the sample was checked by hand — the
 * risk of loosening a matcher is linking the wrong song, which is worse than linking nothing.
 */

/** Bumped whenever the rules here change, so settled misses are retried instead of trusted. */
export const MATCHER_VERSION = 1;

export interface Candidate {
  title: string;
  artist: string;
}

function foldQuotes(value: string): string {
  // backtick included because the library really contains "You`re Gonna Kill That Girl"
  return (value || '').replace(/[‘’ʼ`]/g, '\'').replace(/[“”]/g, '"');
}

/** Lowercase, accent-folded, with "&" spelled out so "Sage & Spirit" meets "Sage and Spirit". */
function fold(value: string): string {
  return foldQuotes(value).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ');
}

/**
 * Two keys, because neither alone is enough.
 *
 * Collapsing punctuation to a space fixes "Uncle Albert/Admiral Halsey" vs
 * "Uncle Albert / Admiral Halsey". Removing it outright fixes "3 A.M." vs "3 AM" and
 * "Boxcar Racer" vs "Box Car Racer", which the spaced key reads as different. A match on
 * either is a match; requiring both would lose half of what each one recovers.
 */
function spacedKey(value: string): string {
  return fold(value).replace(/[^a-z0-9]+/g, ' ').trim().replace(/^the /, '');
}

function tightKey(value: string): string {
  return fold(value).replace(/[^a-z0-9]/g, '').replace(/^the/, '');
}

function sameText(first: string, second: string): boolean {
  return spacedKey(first) === spacedKey(second) || tightKey(first) === tightKey(second);
}

/** Drops one trailing bracketed qualifier: "(Demo)", "[Rainbow Bridge]", "(Summer Song)". */
function unsuffix(value: string): string {
  return foldQuotes(value).replace(/\s*[([][^)\]]*[)\]]\s*$/, '').trim();
}

/**
 * Titles match, allowing a trailing qualifier on either side.
 *
 * Genius and the library disagree about these constantly and in both directions — the library
 * has "Isn't it a Pity (Version One)" where Genius has the plain title, and Genius has
 * "U Can Call (Original Version)" where the library has the plain one. It is the same song and
 * the same lyrics page either way, which is all this extension links to.
 */
function titlesMatch(hitTitle: string, libraryTitle: string): boolean {
  return sameText(hitTitle, libraryTitle) ||
    sameText(unsuffix(hitTitle), libraryTitle) ||
    sameText(hitTitle, unsuffix(libraryTitle)) ||
    sameText(unsuffix(hitTitle), unsuffix(libraryTitle));
}

/**
 * Artists match, allowing one to carry a backing band the other leaves off.
 *
 * Only an explicit "and <band>" counts: "Elvis Costello" vs "Elvis Costello and The
 * Attractions", and "&" has already been folded to "and" so "Bruce Springsteen & The E Street
 * Band" comes through the same path. A bare whole-word prefix is deliberately *not* enough —
 * "Pearl" is a prefix of "Pearl Jam" and a different band, which a looser version of this rule
 * happily linked until a test caught it. ("Pretenders" vs "The Pretenders" needs none of this;
 * the leading "the" is already optional.)
 */
function artistsMatch(hitArtist: string, libraryArtist: string): boolean {
  if (sameText(hitArtist, libraryArtist)) {
    return true;
  }
  const keys = [spacedKey(hitArtist), spacedKey(libraryArtist)]
    .sort((first, second) => first.length - second.length);
  const [shorter, longer] = keys;
  return shorter.length >= 4 && longer.startsWith(`${shorter} and `);
}

/**
 * The best hit for a track, or undefined.
 *
 * Hits are searched in the order Genius returned them, which is its own relevance ranking, but
 * an exact title match is preferred over a qualifier-stripped one at any position: given both
 * "Dolly Dagger" and "Dolly Dagger [Rainbow Bridge]", the plain one is the album track asked
 * for. Without that, the first-passing hit wins and a live or demo cut can displace it.
 */
export function findMatch<T extends Candidate>(
  hits: T[],
  libraryTitle: string,
  libraryArtist: string,
): T | undefined {
  const plausible = hits.filter((hit) =>
    titlesMatch(hit.title, libraryTitle) && artistsMatch(hit.artist, libraryArtist));
  return plausible.find((hit) => sameText(hit.title, libraryTitle)) || plausible[0];
}
