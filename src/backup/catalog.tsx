import {DATA_DIR} from '../constants';
import crypto from 'crypto';
import fs from 'fs';
import {isConfigured, uploadObject} from './gcs';
import {loadManifest, Manifest, normalizeTrackPath, objectNameForTrack} from './musicBackup';

/**
 * Publishes the index the streaming service reads.
 *
 * The phone must work with this laptop asleep, so it cannot ask the desktop what exists. The
 * desktop's whole role is to publish: music bytes under `music/`, and this catalog alongside.
 *
 * Only tracks the **manifest confirms are uploaded** are listed. That matters more than it
 * sounds: during the initial bulk upload the library knows about 21,000 tracks and the bucket
 * holds a few hundred, and a catalog built from the library alone would offer the phone
 * thousands of tracks that 404. The manifest is the difference between "not listed yet" and a
 * broken play button.
 *
 * Objects are timestamped rather than written to a fixed `catalog/latest.json` because the
 * backup service account cannot replace an object - the same append-only constraint that
 * shapes `library/`. The service reads whichever is newest.
 *
 * Tracks carry the desktop's `albumIds`/`artistIds`, and albums and artists ship alongside
 * them. That is what lets the phone fold cloud tracks into the library it already has rather
 * than showing them in a separate list: the ids are the same id space, so a part-synced album
 * merges into one album instead of appearing twice. Album `trackIds` keep their full running
 * order even for tracks that are not uploaded, so the phone can order a mixed album correctly
 * and simply omit what it cannot play.
 */

const STATE_FILE = () => `${DATA_DIR}/catalog-state.json`;
const LIBRARY_FILE = () => `${DATA_DIR}/library.json`;

export interface CatalogTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  year: number;
  /** Milliseconds, as stored on the track. */
  duration: number;
  albumIds: string[];
  artistIds: string[];
  /** Where the bytes are. Server-side only; the service strips this before serving the phone. */
  object: string;
}

export interface CatalogAlbum {
  id: string;
  name: string;
  artistIds: string[];
  /** Full running order, including tracks that are not uploaded. */
  trackIds: string[];
}

export interface CatalogArtist {
  id: string;
  name: string;
}

export interface Catalog {
  generatedAt: string;
  count: number;
  tracks: CatalogTrack[];
  albums: CatalogAlbum[];
  artists: CatalogArtist[];
}

interface CatalogState {
  lastPublishedAt?: number;
  lastHash?: string;
  lastCount?: number;
  lastObject?: string;
}

export function loadCatalogState(): CatalogState {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE(), 'utf8')) as CatalogState;
  } catch (err) {
    return {};
  }
}

function saveCatalogState(state: CatalogState): void {
  try {
    fs.writeFileSync(STATE_FILE(), JSON.stringify(state), 'utf8');
  } catch (err) {
    // bookkeeping only; losing it costs one redundant upload
  }
}

interface RawLibrary {
  tracks?: Record<string, {
    id?: string;
    name?: string;
    filePath?: string;
    duration?: number;
    year?: number;
    artistIds?: string[];
    albumIds?: string[];
  }>;
  artists?: Record<string, {name?: string}>;
  albums?: Record<string, {name?: string; artistIds?: string[]; trackIds?: string[]}>;
}

/** Joins the names a listener actually browses by; ids are meaningless on the phone. */
function firstName(ids: string[] | undefined, lookup: Record<string, {name?: string}>): string {
  if (!ids || !ids.length) {
    return '';
  }
  const found = lookup[ids[0]];
  return (found && found.name) || '';
}

/**
 * Builds the catalog from the library, keeping only tracks whose bytes the manifest confirms.
 *
 * A size mismatch counts as unconfirmed: the file was re-ripped or re-tagged since it was
 * uploaded, so the bucket holds different audio than the library describes.
 */
export function buildCatalog(
  library: RawLibrary = JSON.parse(fs.readFileSync(LIBRARY_FILE(), 'utf8')) as RawLibrary,
  manifest: Manifest = loadManifest(),
  now: Date = new Date(),
): Catalog {
  const artists = library.artists || {};
  const albums = library.albums || {};
  const tracks: CatalogTrack[] = [];
  const seen: Record<string, boolean> = {};
  const albumIdsUsed: Record<string, boolean> = {};
  const artistIdsUsed: Record<string, boolean> = {};

  Object.keys(library.tracks || {}).forEach((id) => {
    const track = (library.tracks || {})[id];
    const filePath = normalizeTrackPath(track.filePath || '');
    if (!filePath) {
      return;
    }
    const object = objectNameForTrack(filePath);
    if (!manifest[object] || seen[object]) {
      return;
    }
    seen[object] = true;
    const trackAlbumIds = track.albumIds || [];
    const trackArtistIds = track.artistIds || [];
    trackAlbumIds.forEach((albumId) => {
      albumIdsUsed[albumId] = true;
    });
    trackArtistIds.forEach((artistId) => {
      artistIdsUsed[artistId] = true;
    });
    tracks.push({
      album: firstName(trackAlbumIds, albums),
      albumIds: trackAlbumIds,
      artist: firstName(trackArtistIds, artists),
      artistIds: trackArtistIds,
      duration: track.duration || 0,
      id: track.id || id,
      name: track.name || '',
      object,
      year: track.year || 0,
    });
  });

  // only the albums and artists these tracks actually belong to; the phone unions them with
  // whatever it already has synced
  const catalogAlbums: CatalogAlbum[] = Object.keys(albumIdsUsed).map((albumId) => {
    const album = albums[albumId] || {};
    return {
      artistIds: album.artistIds || [],
      id: albumId,
      name: album.name || '',
      trackIds: album.trackIds || [],
    };
  });
  const catalogArtists: CatalogArtist[] = Object.keys(artistIdsUsed).map((artistId) => ({
    id: artistId,
    name: (artists[artistId] || {}).name || '',
  }));

  return {
    albums: catalogAlbums,
    artists: catalogArtists,
    count: tracks.length,
    generatedAt: now.toISOString(),
    tracks,
  };
}

export interface CatalogOutcome {
  ok: boolean;
  skipped?: string;
  object?: string;
  count?: number;
  error?: string;
}

/**
 * Publishes the catalog if it has changed since last time. Never throws; the caller is a timer.
 *
 * Hashing the content rather than publishing unconditionally keeps a year of daily runs from
 * leaving 365 near-identical objects in a bucket whose key cannot delete them.
 */
export async function publishCatalog(options: {force?: boolean} = {}): Promise<CatalogOutcome> {
  if (!isConfigured()) {
    return {ok: false, skipped: 'Cloud backup is not set up.'};
  }
  const state = loadCatalogState();
  try {
    // read async: library.json is ~12MB and the renderer is the thread playing audio
    const library = JSON.parse(
      await fs.promises.readFile(LIBRARY_FILE(), 'utf8')) as RawLibrary;
    const catalog = buildCatalog(library);
    if (!catalog.count) {
      return {ok: true, skipped: 'No uploaded tracks to list yet.'};
    }
    const body = JSON.stringify(catalog);
    // the timestamp changes every run, so hash the tracks rather than the whole document
    const hash = crypto.createHash('sha256')
      .update(JSON.stringify([catalog.tracks, catalog.albums, catalog.artists])).digest('hex');
    if (!options.force && hash === state.lastHash) {
      return {count: catalog.count, ok: true, skipped: 'Catalog unchanged.'};
    }
    const object = `catalog/${catalog.generatedAt.replace(/[:.]/g, '-')}.json`;
    await uploadObject(object, body);
    saveCatalogState({
      lastCount: catalog.count,
      lastHash: hash,
      lastObject: object,
      lastPublishedAt: Date.now(),
    });
    return {count: catalog.count, object, ok: true};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {error: message, ok: false};
  }
}
