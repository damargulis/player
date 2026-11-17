import {normalizeQuotes} from '../utils';
import {formatGenre, nameKey} from '../../utils';

const API_BASE = 'https://musicbrainz.org/ws/2';
export const COVER_ART_BASE = 'https://coverartarchive.org';
const WIKI_BASE_URL = 'https://en.wikipedia.org/wiki/';
// MusicBrainz requires a meaningful user agent with contact info and allows
// at most one request per second per client.
const USER_AGENT = 'MyMusic/0.1.0 (damargulis1@gmail.com)';
const REQUEST_SPACING_MS = 1100;
// Search results below this score are unrelated matches.
const MIN_SCORE = 90;

export interface ArtistCredit {
  name: string;
}

export interface ReleaseGroupResult {
  'id': string;
  'score': number;
  'title': string;
  'primary-type'?: string;
  /** "Live", "Compilation", "Remix", "Soundtrack"… — empty for an ordinary studio album. */
  'secondary-types'?: string[];
  'first-release-date'?: string;
  'artist-credit'?: ArtistCredit[];
}

export interface GenreResult {
  name: string;
  count: number;
}

export interface ReleaseGroupLookup {
  'first-release-date'?: string;
  'secondary-types'?: string[];
  'genres'?: GenreResult[];
  'relations'?: UrlRelation[];
}

export interface ArtistResult {
  id: string;
  score: number;
  name: string;
}

export interface UrlRelation {
  type: string;
  url?: {resource: string};
}

export interface ArtistLookup {
  genres?: GenreResult[];
  relations?: UrlRelation[];
}

export interface ArtistCreditPart {
  name: string;
  joinphrase?: string;
}

export interface ReleaseTrack {
  'title': string;
  'position': number;
  'artist-credit'?: ArtistCreditPart[];
  /** Present with `inc=recordings`; the key into `browseRecordings`. */
  'recording'?: {id: string};
}

export interface RecordingResult {
  'id': string;
  'genres'?: GenreResult[];
  /** "1976-12-08", "1976" or "" — the earliest release of this recording anywhere. */
  'first-release-date'?: string;
}

/**
 * Every recording on a release, with its genres, keyed by recording id. One request per album.
 *
 * Keyed rather than returned in order because this endpoint does not promise track order; the
 * caller maps each local track to its recording through the release's own tracklist.
 */
export function browseRecordings(releaseId: string): Promise<Record<string, RecordingResult>> {
  const url = `${API_BASE}/recording?release=${releaseId}&inc=genres&fmt=json&limit=100`;
  return apiFetch(url).then((data: {recordings?: RecordingResult[]}) => {
    const byId = {} as Record<string, RecordingResult>;
    (data.recordings || []).forEach((recording) => {
      byId[recording.id] = recording;
    });
    return byId;
  });
}

/**
 * What a recording says about one track: its genres and the year it first came out.
 *
 * Per song rather than per album. Tracks inherit genres from the iTunes import, and their years
 * from whatever pressing was ripped — "Hybrid Theory" sits in the library as 2023, the
 * anniversary reissue, with its songs from 2000. A recording's `first-release-date` is the
 * earliest release of that recording anywhere, so a remaster that reuses the original recording
 * reports the original year. Its one quirk: a lead single released before its album reports the
 * single's year, which is when the song did come out.
 *
 * Probed before building: about 90% of recordings on a sample of albums here carry genres,
 * compilations being the exception. Genres go through the same top-five-by-votes cut as an
 * album's, since a recording often carries eight or nine.
 */
export function recordingUpdate(recording?: RecordingResult): {genres: string[]; year?: number} {
  if (!recording) {
    return {genres: []};
  }
  const year = parseInt((recording['first-release-date'] || '').slice(0, 4), 10);
  return {genres: getGenreNames(recording.genres), year: year > 0 ? year : undefined};
}

export interface Media {
  'track-count': number;
  'tracks'?: ReleaseTrack[];
}

export interface ReleaseResult {
  id: string;
  status?: string;
  date?: string;
  media?: Media[];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Statuses worth retrying: rate limited or transient server trouble.
const RETRYABLE_STATUSES = [429, 502, 503, 504];
const MAX_ATTEMPTS = 4;
const RETRY_BASE_MS = 1500;

/**
 * Fetches with retries on rate-limit/transient errors. MusicBrainz 503s
 * whenever the rate limit is grazed, so a single attempt is flaky.
 */
export function fetchWithRetry(url: string, options: RequestInit = {}, attempt: number = 1): Promise<Response> {
  return fetch(url, options).then((res) => {
    if (RETRYABLE_STATUSES.includes(res.status) && attempt < MAX_ATTEMPTS) {
      return delay(attempt * RETRY_BASE_MS).then(() => fetchWithRetry(url, options, attempt + 1));
    }
    return res;
  }, (err) => {
    if (attempt < MAX_ATTEMPTS) {
      return delay(attempt * RETRY_BASE_MS).then(() => fetchWithRetry(url, options, attempt + 1));
    }
    return Promise.reject(err);
  });
}

let queue = Promise.resolve() as Promise<{}|void>;

/** Fetches a MusicBrainz API url, spacing out requests to respect the rate limit. */
function apiFetch(url: string): Promise<{}> {
  const result = queue.then(() => {
    return fetchWithRetry(url, {headers: {'User-Agent': USER_AGENT}}).then((res) => {
      if (!res.ok) {
        return Promise.reject(new Error(`MusicBrainz request failed: ${res.status}`));
      }
      return res.json();
    });
  });
  queue = result.then(() => delay(REQUEST_SPACING_MS), () => delay(REQUEST_SPACING_MS));
  return result;
}

const MBID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Extracts an mbid from user input: a musicbrainz.org url or a bare id. */
export function parseMbid(input?: string): string | undefined {
  const match = (input || '').match(MBID_PATTERN);
  return match ? match[0].toLowerCase() : undefined;
}

export function musicBrainzUrl(entityType: 'release-group' | 'artist', mbid?: string): string {
  return mbid ? `https://musicbrainz.org/${entityType}/${mbid}` : '';
}

function escapeLucene(term: string): string {
  return term.replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, '\\$1');
}

/**
 * The key two names are compared on.
 *
 * Accents are **folded** before the strip, not stripped by it. Without that, `[^a-z0-9]` eats
 * the accented letter itself: "Sigur Rós" keyed as `sigurrs`, "Beyoncé" as `beyonc` and "Mýa"
 * as `ma`. That is symmetric while both sides are accented, but an iTunes library holding
 * "Sigur Ros" against MusicBrainz's "Sigur Rós" gave `sigurros` against `sigurrs` and no
 * match — and 14 artists here carry a non-ASCII letter.
 *
 * This is the same bug the games had (14 artists and 15 albums unguessable, fixed in
 * `game-common.js`'s own `normalize`) and the fold is the one already used by every search box.
 */
function normalize(str: string): string {
  return nameKey(str);
}

export function searchReleaseGroups(albumName: string, artistName?: string): Promise<ReleaseGroupResult[]> {
  let query = `releasegroup:"${escapeLucene(albumName)}"`;
  if (artistName) {
    query += ` AND artist:"${escapeLucene(artistName)}"`;
  }
  const url = `${API_BASE}/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=10`;
  return apiFetch(url).then((data: {'release-groups'?: ReleaseGroupResult[]}) => {
    return data['release-groups'] || [];
  });
}

export function lookupReleaseGroup(mbid: string): Promise<ReleaseGroupLookup> {
  // url-rels as well as genres: the relations are how the Wikipedia page is found without
  // guessing urls, and asking for both costs the same single request
  const inc = encodeURIComponent('genres+url-rels');
  return apiFetch(`${API_BASE}/release-group/${mbid}?inc=${inc}&fmt=json`);
}

export function searchArtists(artistName: string): Promise<ArtistResult[]> {
  const query = `artist:"${escapeLucene(artistName)}"`;
  const url = `${API_BASE}/artist/?query=${encodeURIComponent(query)}&fmt=json&limit=10`;
  return apiFetch(url).then((data: {artists?: ArtistResult[]}) => {
    return data.artists || [];
  });
}

export function lookupArtist(mbid: string): Promise<ArtistLookup> {
  const inc = encodeURIComponent('genres+url-rels');
  return apiFetch(`${API_BASE}/artist/${mbid}?inc=${inc}&fmt=json`);
}

function commonsFilePath(fileName: string): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`;
}

/**
 * Resolves an artist picture url from the artist's direct image relation,
 * falling back to the image property of its linked Wikidata entity.
 */
export function getArtistImageUrl(lookup: ArtistLookup): Promise<string | undefined> {
  const relations = lookup.relations || [];
  const image = relations.find((rel) => rel.type === 'image' && !!rel.url);
  if (image && image.url) {
    const resource = image.url.resource;
    // Commons page urls point at an html page; Special:FilePath serves the file.
    const match = resource.match(/commons\.wikimedia\.org\/wiki\/File:(?<file>.*)$/);
    if (match && match.groups) {
      return Promise.resolve(commonsFilePath(decodeURIComponent(match.groups.file)));
    }
    return Promise.resolve(resource);
  }
  const wikidata = relations.find((rel) => rel.type === 'wikidata' && !!rel.url);
  if (!wikidata || !wikidata.url) {
    return Promise.resolve(undefined);
  }
  const entityId = wikidata.url.resource.split('/').pop() as string;
  return fetchWithRetry(`https://www.wikidata.org/wiki/Special:EntityData/${entityId}.json`)
    .then((res) => res.json())
    .then((data) => {
      const entity = data.entities && data.entities[entityId];
      const claims = entity && entity.claims && entity.claims.P18;
      const fileName = claims && claims[0] && claims[0].mainsnak &&
        claims[0].mainsnak.datavalue && claims[0].mainsnak.datavalue.value;
      return fileName ? commonsFilePath(fileName) : undefined;
    })
    .catch(() => undefined);
}

/** The Wikipedia page title a Wikidata entity links to, from its English sitelink. */
function enwikiTitle(data: unknown, entityId: string): string | undefined {
  const entities = (data as {entities?: Record<string, {sitelinks?:
    Record<string, {title?: string}>; }>; }).entities;
  const entity = entities && entities[entityId];
  const sitelink = entity && entity.sitelinks && entity.sitelinks.enwiki;
  return (sitelink && sitelink.title) || undefined;
}

/**
 * Resolves the English Wikipedia page for an entity from its MusicBrainz relations.
 *
 * This is the path the Wikipedia extension does not have. That one guesses urls — four for an
 * artist, ten for an album — built by slugging the name, which is why artist coverage sat at
 * 66% while 90% of artists had an mbid all along. MusicBrainz already knows the answer and the
 * lookups already ask for `url-rels`, so it was arriving and being thrown away.
 *
 * Most entities carry a `wikidata` relation rather than a `wikipedia` one — measured over this
 * library, 16 of 20 sampled artists versus 1 — so the Wikidata entity has to be fetched for
 * its `enwiki` sitelink. That request is the same one `getArtistImageUrl` already makes for
 * the artist picture.
 */
export function getWikiPageUrl(relations?: UrlRelation[]): Promise<string | undefined> {
  const rels = relations || [];
  const direct = rels.find((rel) => rel.type === 'wikipedia' && !!rel.url);
  if (direct && direct.url) {
    return Promise.resolve(direct.url.resource);
  }
  const wikidata = rels.find((rel) => rel.type === 'wikidata' && !!rel.url);
  if (!wikidata || !wikidata.url) {
    return Promise.resolve(undefined);
  }
  const entityId = wikidata.url.resource.split('/').pop() as string;
  return fetchWithRetry(`https://www.wikidata.org/wiki/Special:EntityData/${entityId}.json`)
    .then((res) => res.json())
    .then((data) => {
      const title = enwikiTitle(data, entityId);
      // the same form the extension's own url guesses take, so nothing downstream can tell
      // a page found this way from one found by guessing
      return title ? `${WIKI_BASE_URL}${encodeURIComponent(title.replace(/ /g, '_'))}` : undefined;
    })
    .catch(() => undefined);
}

export function browseReleases(releaseGroupMbid: string): Promise<ReleaseResult[]> {
  const inc = encodeURIComponent('recordings+artist-credits');
  const url = `${API_BASE}/release/?release-group=${releaseGroupMbid}&inc=${inc}&fmt=json&limit=100`;
  return apiFetch(url).then((data: {releases?: ReleaseResult[]}) => {
    return data.releases || [];
  });
}

export function getReleaseTrackCount(release: ReleaseResult): number {
  return (release.media || []).reduce((total, media) => total + media['track-count'], 0);
}

/** Returns the release's tracks flattened across discs, in play order. */
export function getReleaseTracks(release: ReleaseResult): ReleaseTrack[] {
  return (release.media || []).map((media) => media.tracks || []).flat().map((track) => ({
    ...track,
    'title': normalizeQuotes(track.title),
    'artist-credit': (track['artist-credit'] || []).map((credit) => {
      return {...credit, name: normalizeQuotes(credit.name)};
    }),
  }));
}

/**
 * Picks the release edition whose track count matches the local album,
 * preferring official releases and earlier editions.
 */
export function pickMatchingRelease(releases: ReleaseResult[], trackCount: number): ReleaseResult | undefined {
  const sorted = [...releases].sort((release1, release2) => {
    const official1 = release1.status === 'Official' ? 0 : 1;
    const official2 = release2.status === 'Official' ? 0 : 1;
    if (official1 !== official2) {
      return official1 - official2;
    }
    return (release1.date || '9999').localeCompare(release2.date || '9999');
  });
  return sorted.find((release) => getReleaseTrackCount(release) === trackCount);
}

/**
 * Returns the original edition(s) of the album: the official releases sharing
 * the earliest release date (several when day-one regional variants exist).
 */
export function getOriginalReleases(releases: ReleaseResult[]): ReleaseResult[] {
  const officials = releases.filter((release) => release.status === 'Official');
  const candidates = officials.length ? officials : releases;
  if (!candidates.length) {
    return [];
  }
  const sorted = [...candidates].sort((release1, release2) => {
    return (release1.date || '9999').localeCompare(release2.date || '9999');
  });
  const earliest = sorted[0].date || '9999';
  return sorted.filter((release) => (release.date || '9999') === earliest);
}

export enum TracklistMatch {
  ORIGINAL,
  OTHER_EDITION,
  MISSING_TRACKS,
  NO_MATCH,
}

export interface TracklistMatchResult {
  type: TracklistMatch;
  release?: ReleaseResult;
}

/**
 * Matches the local track count against the album's editions. The original
 * release is the canonical tracklist: having fewer tracks than it (e.g.
 * missing the bonus tracks it originally shipped with) is MISSING_TRACKS.
 * Having more is fine as long as it lines up with a complete later edition
 * (a deluxe or rerelease), whose extra tracks are considered a different
 * version of the album rather than missing ones.
 */
export function matchTracklist(releases: ReleaseResult[], trackCount: number): TracklistMatchResult {
  const originals = getOriginalReleases(releases);
  if (!originals.length) {
    return {type: TracklistMatch.NO_MATCH};
  }
  const original = originals.find((release) => getReleaseTrackCount(release) === trackCount);
  if (original) {
    return {type: TracklistMatch.ORIGINAL, release: original};
  }
  const smallestOriginal = Math.min(...originals.map(getReleaseTrackCount));
  if (trackCount < smallestOriginal) {
    return {type: TracklistMatch.MISSING_TRACKS};
  }
  const otherEdition = pickMatchingRelease(releases, trackCount);
  if (otherEdition) {
    return {type: TracklistMatch.OTHER_EDITION, release: otherEdition};
  }
  return {type: TracklistMatch.NO_MATCH};
}

/** Returns artists credited after a "feat." style join phrase in a track's credits. */
export function getFeaturedArtists(track: ReleaseTrack): string[] {
  const credits = track['artist-credit'] || [];
  const featured = [] as string[];
  let inFeature = false;
  credits.forEach((credit) => {
    if (inFeature && credit.name) {
      featured.push(credit.name);
    }
    if ((credit.joinphrase || '').toLowerCase().includes('feat')) {
      inFeature = true;
    }
  });
  return featured;
}

function creditMatchesArtist(creditName: string, artistName: string): boolean {
  const credit = normalize(creditName);
  const artist = normalize(artistName);
  // Substring in either direction so collaboration credits ("Courtney Barnett
  // and Kurt Vile") match the individual artists the album is assigned to.
  return credit.includes(artist) || artist.includes(credit);
}

/**
 * Picks the release group whose title exactly matches the album, preferring
 * matches credited to any of the album's artists and typed as full albums.
 */
export function pickBestReleaseGroup(
    results: ReleaseGroupResult[], albumName: string, artistNames: string[] = []): ReleaseGroupResult | undefined {
  let candidates = results.filter((result) => {
    return result.score >= MIN_SCORE && normalize(result.title) === normalize(albumName);
  });
  if (artistNames.length) {
    const byArtist = candidates.filter((result) => {
      return (result['artist-credit'] || []).some((credit) => {
        return artistNames.some((artistName) => creditMatchesArtist(credit.name, artistName));
      });
    });
    if (byArtist.length) {
      candidates = byArtist;
    }
  }
  // The original, not a live album, a compilation or a later pressing, unless the album's own
  // name says that is what it is. "Hotel California" was matched to a 1992 *live* album, which
  // MusicBrainz types as primary "Album" — the old rule took the first such result, so it won —
  // and the library has said 1992 ever since. Exact title matching already handles a reissue the
  // library *does* name: "Hybrid Theory (20th Anniversary Edition)" only matches a group titled so.
  return candidates.slice().sort((one, two) => rank(one, albumName) - rank(two, albumName) ||
    (one['first-release-date'] || '9999').localeCompare(two['first-release-date'] || '9999'))[0];
}

/**
 * The kinds of release an album's own name can ask for.
 *
 * A secondary type is only acceptable when the library album says so in its name — "Live at
 * Leeds", "Greatest Hits", "… (Remixes)". Anything else is treated as a sign the match is a
 * different record that happens to share the title.
 */
const NAME_ALLOWS: Record<string, RegExp> = {
  'Compilation': /\b(greatest|best of|hits|collection|anthology|essential|compilation|singles)\b/i,
  'DJ-mix': /\b(dj|mix)\b/i,
  'Demo': /\bdemos?\b/i,
  'Live': /\b(live|concert|unplugged|in concert|sessions?)\b/i,
  'Mixtape/Street': /\b(mixtape|tape)\b/i,
  'Remix': /\b(remix(es)?|remixed|reworked)\b/i,
  'Soundtrack': /\b(soundtrack|o\.?s\.?t|motion picture|score)\b/i,
};

/** Secondary types the album's name does not account for. */
export function unexplainedTypes(types: string[] | undefined, albumName: string): string[] {
  return (types || []).filter((type) => {
    const allows = NAME_ALLOWS[type];
    return !allows || !allows.test(albumName);
  });
}

/** Lower is better: a studio album first, then the fewest unexplained secondary types. */
function rank(result: ReleaseGroupResult, albumName: string): number {
  const notAlbum = result['primary-type'] === 'Album' ? 0 : 10;
  return notAlbum + unexplainedTypes(result['secondary-types'], albumName).length;
}

/** Picks the artist result whose name exactly matches, if any. */
export function pickBestArtist(results: ArtistResult[], artistName: string): ArtistResult | undefined {
  const candidates = results.filter((result) => result.score >= MIN_SCORE);
  return candidates.find((result) => normalize(result.name) === normalize(artistName));
}

/** Returns genre names ordered by how many MusicBrainz users tagged them. */
export function getGenreNames(genres?: GenreResult[]): string[] {
  return (genres || [])
    .filter((genre) => genre.count > 0)
    .sort((genre1, genre2) => genre2.count - genre1.count)
    .slice(0, 5)
    .map((genre) => formatGenre(genre.name));
}
