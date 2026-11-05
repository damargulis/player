import {Album, AlbumInfo, LibraryInfo, UPDATE_LIBRARY} from '../../redux/actionTypes';
import {fetchFrontCover} from './api';
import {DATA_DIR} from '../../constants';
import {ipcRenderer} from 'electron';
import {ExtensionError} from '../errors';
import PromisePool from 'es6-promise-pool';
import fs from 'fs';
import {imageSize, sizeFromBuffer} from '../imageSize';
import {getAlbumsByIds, getArtistsByIds} from '../../redux/selectors';
import shortid from 'shortid';
import reduxStore, {RootState} from '../../redux/store';
import {getPool} from '../utils';

/**
 * Replaces small album art with the biggest the Cover Art Archive offers.
 *
 * Three things have written art into `data/` over this library's life — the iTunes import, the
 * Wikipedia infobox image, and the MusicBrainz extension asking CAA for `front-500` — and the
 * result is uneven: across 2,128 readable files, 17% are under 250px and 79% sit at exactly
 * 500, with only 7 albums holding anything larger. That ceiling is simply what the old code
 * asked for, and it limits how good the album browser, the Now Playing card on a TV, and
 * Album Art Zoom can look.
 *
 * So this is an upgrade pass, not a gap fill: only 10 albums have an mbid and no art at all,
 * against 838 whose art is smaller than CAA would serve.
 */

/**
 * The size asked of CAA, and the ceiling past which art is left alone.
 *
 * Measured over 25 real release-groups: `front-1200` is ~206KB each, about 458MB for the
 * library, against 1,855MB for the originals — four times the bytes for detail nothing in the
 * app can display.
 *
 * Compared against the **longer** side, because that is the dimension CAA scales: `front-1200`
 * on a 1400x1160 cover returns 1200x994, so judging by the shorter side would call a cover
 * already at the Archive's maximum "too small" and refetch it on every run.
 */
const TARGET_PX = 1200;

/**
 * How many results to commit to the library at once.
 *
 * The library reducer rewrites the whole 12MB file on every update, and this pass touches up
 * to 2,000 albums. Committing only at the end is the mistake the lyrics extension already
 * made: a long run shows nothing, and closing the app first throws the lot away.
 */
const COMMIT_EVERY = 25;

type Outcome = 'upgraded' | 'kept' | 'none' | 'no-mbid' | 'failed';

interface Result {
  id: string;
  info: AlbumInfo;
  outcome: Outcome;
}

/**
 * Whether this album is worth a request.
 *
 * Pulled out as a pure function because everything around it is I/O — `jest.mock` is unusable
 * in this repo (the tests run inside Electron), so the only testable logic is the logic that
 * touches nothing. `currentPx` is the longer side of the art on disk, 0 when there is none or
 * it is unreadable.
 */
export function shouldFetch(album: Album, currentPx: number): boolean {
  if (!album.mbid) {
    // nothing to ask CAA with; the MusicBrainz extension is what fills mbids in
    return false;
  }
  if (currentPx >= TARGET_PX) {
    return false;
  }
  // Asked before, at a target no smaller than this one, and the file is already as big as the
  // Archive managed. CAA does not upscale, so there is nothing to gain by asking again — this
  // is what stops a second run re-downloading every cover whose original is under 1200px.
  const mark = album.coverArt;
  return !(mark && mark.target >= TARGET_PX && currentPx >= mark.maxPx);
}

/** The dimension CAA scales, so the one to compare its sizes against. */
function longerSide(filePath: string): number {
  const size = imageSize(filePath);
  return size ? Math.max(size.width, size.height) : 0;
}

/** The album's errors with the art error added or cleared, as a fresh array for the delta. */
function errorsWith(album: Album, hasArt: boolean): string[] {
  const errors = (album.errors || []).filter((error) => error !== ExtensionError.ALBUM_ART);
  if (!hasArt) {
    errors.push(ExtensionError.ALBUM_ART);
  }
  return errors;
}

/**
 * Writes the art, reusing the album's existing file path.
 *
 * Overwriting in place rather than minting a new shortid, because nothing in the app ever
 * deletes an art file — a new path each run would leave the old one orphaned in `data/` and
 * the upgrade would cost double the disk it saved.
 */
function writeArt(album: Album, data: Buffer): string {
  const filePath = album.albumArtFile || `${DATA_DIR}/${shortid.generate()}.png`;
  fs.writeFileSync(filePath, data);
  return filePath;
}

/**
 * Fetches better art for one album, or decides it needs none.
 *
 * The decision comes from the file on disk, not from a stored marker: the file is the
 * authority, reading its header costs a few hundred bytes, and a marker would have to be kept
 * in step with whatever else writes art. Unreadable counts as "needs art" — one album here has
 * an HTML error page saved as its cover.
 */
function upgradeAlbum(album: Album): Promise<Result> {
  const current = album.albumArtFile ? longerSide(album.albumArtFile) : 0;
  if (!shouldFetch(album, current)) {
    return Promise.resolve({id: album.id, info: {},
      outcome: album.mbid ? 'kept' : 'no-mbid'});
  }
  return fetchFrontCover(album.mbid as string).then((data) => {
    if (!data) {
      // deliberately no marker: only ~44 albums land here, retrying one request each is
      // cheaper than never noticing art the community adds later
      return {id: album.id, info: {errors: errorsWith(album, false)}, outcome: 'none' as Outcome};
    }
    const size = sizeFromBuffer(data);
    const got = size ? Math.max(size.width, size.height) : 0;
    const coverArt = {maxPx: Math.max(got, current), target: TARGET_PX};
    if (got <= current) {
      // what came back is no better than what is on disk; record that and stop asking
      return {id: album.id, info: {coverArt, errors: errorsWith(album, current > 0)},
        outcome: 'kept' as Outcome};
    }
    return {
      id: album.id,
      info: {albumArtFile: writeArt(album, data), coverArt, errors: errorsWith(album, true)},
      outcome: 'upgraded' as Outcome,
    };
  }).catch(() => ({id: album.id, info: {}, outcome: 'failed' as Outcome}));
}

function getAlbumPool(store: RootState, albumIds: string[], extensionId: string):
  PromisePool<Result | void> {
  const albums = getAlbumsByIds(store, albumIds);
  return getPool(
    store,
    albums,
    /* prefix= */ 'album-',
    (album) => {
      const artist = getArtistsByIds(store, album.artistIds)
        .map((artistData) => artistData.name).join(', ');
      return `${album.name} by: ${artist}`;
    },
    (_store: RootState, album: Album) => upgradeAlbum(album),
    extensionId,
  );
}

export default function runCoverArtExtension(store: RootState, albumIds: string[]):
  PromiseLike<LibraryInfo> {
  const extensionId = shortid.generate();
  const albums = {} as Record<string, AlbumInfo>;
  const tally = {'failed': 0, 'kept': 0, 'none': 0, 'no-mbid': 0, 'upgraded': 0};
  let uncommitted = {} as Record<string, AlbumInfo>;
  const commit = (): void => {
    const batch = uncommitted;
    uncommitted = {};
    if (Object.keys(batch).length) {
      reduxStore.dispatch({payload: {library: {albums: batch}}, type: UPDATE_LIBRARY});
    }
  };
  const pool = getAlbumPool(store, albumIds, extensionId);
  pool.addEventListener('fulfilled', (evt) => {
    const e = evt as unknown as {data: {result: Result}};
    const {result} = e.data;
    tally[result.outcome]++;
    albums[result.id] = result.info;
    if (Object.keys(result.info).length) {
      uncommitted[result.id] = result.info;
      if (Object.keys(uncommitted).length >= COMMIT_EVERY) {
        commit();
      }
    }
  });
  return pool.start().then(() => {
    commit();
    // Spelling the outcomes out separately, because "N albums modified" could not distinguish
    // a library already at full resolution from a run that asked for nothing.
    const msg = `Cover Art Finished.<br>
      ${albumIds.length} albums considered.<br>
      ${tally.upgraded} upgraded to larger art.<br>
      ${tally.kept} already as big as the Archive has.<br>
      ${tally.none} with no front cover in the Archive.<br>
      ${tally['no-mbid']} skipped — no MusicBrainz id, run that extension first.<br>
      ${tally.failed ? `${tally.failed} failed; re-running retries them.<br>` : ''}
    `;
    ipcRenderer.send('extension-update', {extensionId, msg, type: 'done'});
    return {albums};
  });
}
