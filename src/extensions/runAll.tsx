import {Album, Artist, LibraryInfo, UPDATE_LIBRARY} from '../redux/actionTypes';
import {ipcRenderer} from 'electron';
import runCoverArtExtension from './coverart/main';
import runGeniusExtension from './genius/main';
import runLyricsExtension from './lyrics/main';
import runMusicBrainzExtension from './musicbrainz/main';
import runWikiExtension from './wiki/main';
import {getAlbumById, getArtistById} from '../redux/selectors';
import shortid from 'shortid';
import reduxStore from '../redux/store';

/**
 * Runs every extension over one album and its tracks.
 *
 * Sequential and in this order on purpose. **MusicBrainz first**, because it is what fills in
 * `Album.mbid`, and Cover Art has nothing to ask the Archive with until it exists — on a fresh
 * album, running them the other way round means the cover-art step does nothing and looks
 * broken. Wikipedia next, then Cover Art, then the two per-track ones.
 *
 * Each step reads the store **again** rather than closing over one snapshot. The extensions
 * take a `RootState` and read the album out of it, so a snapshot taken before MusicBrainz ran
 * still has no `mbid` no matter what MusicBrainz dispatched. That is the whole reason this
 * lives here instead of being chained together in the component, where `this.props` holds
 * exactly such a snapshot.
 */

export interface RunStep {
  name: string;
  run(album: Album, extensionId: string): PromiseLike<unknown>;
}

const STEPS: RunStep[] = [
  {
    name: 'MusicBrainz',
    run: (album, id) => runMusicBrainzExtension([album.id], /* artistIds= */ [],
      reduxStore.getState(), id),
  },
  {
    name: 'Wikipedia',
    run: (album, id) => runWikiExtension([album.id], /* artistIds= */ [], reduxStore.getState(), id),
  },
  {
    name: 'Cover art',
    run: (album, id) => runCoverArtExtension(reduxStore.getState(), [album.id], id),
  },
  {
    name: 'Genius',
    run: (album, id) => runGeniusExtension(reduxStore.getState(), album.trackIds, id),
  },
  {
    name: 'Lyrics',
    run: (album, id) => runLyricsExtension(reduxStore.getState(), album.trackIds, id),
  },
];

export function stepNames(): string[] {
  return STEPS.map((step) => step.name);
}

/**
 * The same idea for an artist: the artist itself, then everything under it.
 *
 * Cover art is per album and Genius and Lyrics are per track, so an artist run covers all of
 * their albums and all of their tracks — which for the biggest artist here is 253 tracks, so
 * the caller has to be honest with the listener about the size before starting.
 */
interface ArtistStep {
  name: string;
  run(artist: Artist, extensionId: string): PromiseLike<unknown>;
}

/**
 * The steps that are about the artist itself, rather than everything underneath them.
 *
 * Kept separate because a run that also covers the artist's albums does not need the artist
 * pass to sweep their tracks again: the New Tracks import ran Genius and Lyrics twice over the
 * same tracks, once for the album and once for the artist who made it.
 */
const ARTIST_META_STEPS: ArtistStep[] = [
  {
    name: 'MusicBrainz',
    run: (artist, id) => runMusicBrainzExtension(/* albumIds= */ [], [artist.id],
      reduxStore.getState(), id),
  },
  {
    name: 'Wikipedia',
    run: (artist, id) => runWikiExtension(/* albumIds= */ [], [artist.id], reduxStore.getState(), id),
  },
];

const ARTIST_STEPS: ArtistStep[] = [
  ...ARTIST_META_STEPS,
  {
    name: 'Cover art',
    run: (artist, id) => runCoverArtExtension(reduxStore.getState(), artist.albumIds, id),
  },
  {
    name: 'Genius',
    run: (artist, id) => runGeniusExtension(reduxStore.getState(), artist.trackIds, id),
  },
  {
    name: 'Lyrics',
    run: (artist, id) => runLyricsExtension(reduxStore.getState(), artist.trackIds, id),
  },
];

export function artistStepNames(): string[] {
  return ARTIST_STEPS.map((step) => step.name);
}

/** Exported for the tests: the steps a mixed album/artist run gives an artist. */
export function artistMetaStepNames(): string[] {
  return ARTIST_META_STEPS.map((step) => step.name);
}

/**
 * Runs each extension in turn, dispatching its delta before the next starts.
 *
 * `onStep` reports what is running, because the whole sequence is minutes of work on an album
 * with no metadata and a button that sits there is indistinguishable from one that failed.
 *
 * A step that throws does not stop the rest: these are five unrelated services, and Genius
 * being rate-limited is no reason to skip the lyrics. Failures are collected and returned.
 */
/**
 * A monitor window shared by everything in one batch.
 *
 * A new `extensionId` is what opens a window, and `runSteps` used to mint one per entity — so a
 * sweep over two albums and two artists opened four windows, and the album picker's "Run
 * extensions (50)" would have opened fifty. `group-done` is what puts the Done button up, so
 * only the batch may send it: one per entity offered to close a window with four entities still
 * to go.
 */
export interface SharedRun {
  extensionId: string;
  /** Names the entity in the section heading, so one window across many stays readable. */
  label: string;
}

function runSteps<T>(
  steps: Array<{name: string; run(entity: T, extensionId: string): PromiseLike<unknown>}>,
  lookup: () => T | undefined,
  onStep?: (name: string) => void,
  shared?: SharedRun,
): Promise<string[]> {
  const failed: string[] = [];
  // One id for the whole run, so the extensions report into one monitor window instead of
  // opening one each. `group` suppresses the per-step Done button.
  const extensionId = shared ? shared.extensionId : shortid.generate();
  if (!shared) {
    ipcRenderer.send('extension-update', {extensionId, steps: steps.length, type: 'group'});
  }
  return steps.reduce((chain, step, index) => chain.then(() => {
    // read the entity fresh: an earlier step may have given it the id this one needs
    const entity = lookup();
    if (!entity) {
      return Promise.resolve();
    }
    if (onStep) {
      onStep(step.name);
    }
    ipcRenderer.send('extension-update', {
      extensionId,
      msg: shared
        ? `${shared.label} — ${step.name} (${index + 1} of ${steps.length})`
        : `${step.name} (${index + 1} of ${steps.length})`,
      type: 'section',
    });
    return Promise.resolve(step.run(entity, extensionId)).then((updates) => {
      if (updates) {
        // the literal action rather than the creator, whose `type` widens to string
        reduxStore.dispatch({payload: {library: updates as LibraryInfo}, type: UPDATE_LIBRARY});
      }
    }, () => {
      failed.push(step.name);
    });
  }), Promise.resolve()).then(() => {
    if (shared) {
      // the batch sends one group-done when every entity is through; see SharedRun
      return failed;
    }
    // Sent whatever happened: a step that threw never sends its own summary, so counting
    // summaries would leave the window with no Done button at all.
    ipcRenderer.send('extension-update', {
      extensionId,
      failed: failed.length > 0,
      msg: failed.length
        ? `<b>Finished.</b> ${failed.join(' and ')} failed; re-running retries them.`
        : `<b>All ${steps.length} extensions finished.</b>`,
      type: 'group-done',
    });
    return failed;
  });
}

/** Opens the one window a batch reports into. */
export function startSharedRun(): string {
  const extensionId = shortid.generate();
  ipcRenderer.send('extension-update', {extensionId, type: 'group'});
  return extensionId;
}

/** Closes it off, whatever happened — the only thing that puts the Done button up. */
export function finishSharedRun(extensionId: string, done: number, total: number, failed: string[]): void {
  const stopped = done < total ? ' (stopped early)' : '';
  ipcRenderer.send('extension-update', {
    extensionId,
    failed: failed.length > 0,
    msg: failed.length
      ? `<b>Finished ${done} of ${total}${stopped}.</b> ${failed.join(' and ')} failed somewhere; ` +
        're-running retries them.'
      : `<b>Finished ${done} of ${total}${stopped}.</b>`,
    type: 'group-done',
  });
}

export default function runAllForAlbum(
  albumId: string,
  onStep?: (name: string) => void,
  shared?: SharedRun,
): Promise<string[]> {
  return runSteps(STEPS, () => getAlbumById(reduxStore.getState(), albumId), onStep, shared);
}

export function runAllForArtist(
  artistId: string,
  onStep?: (name: string) => void,
  shared?: SharedRun,
  steps: ArtistStep[] = ARTIST_STEPS,
): Promise<string[]> {
  return runSteps(steps, () => getArtistById(reduxStore.getState(), artistId), onStep, shared);
}

export interface BatchProgress {
  /** 1-based, for display. */
  index: number;
  total: number;
  name: string;
  step: string;
}

/**
 * Runs every extension over a list of albums, one album at a time.
 *
 * Sequential across albums as well as within one, because the point of the per-album order —
 * MusicBrainz before Cover art — only holds if the steps actually finish before the next
 * starts, and because the APIs behind them are rate-limited anyway. A whole library would be
 * hours, so the caller is expected to say how many and let the listener decide.
 *
 * `stop` is checked between albums rather than between steps: abandoning mid-album would leave
 * it with an mbid and no cover art, which looks like a bug rather than a cancellation.
 */
/**
 * A mixed run over albums and artists, described as `album:<id>` / `artist:<id>`.
 *
 * One list rather than two calls because the New Tracks page wants a single action over
 * whatever a drop brought in — the albums it landed on and the artists credited on it — and the
 * button that drives it counts, captures and reports progress over exactly one list. Two lists
 * would mean two confirmations and two progress lines for one conceptual thing.
 *
 * Albums are expected first: an artist run covers its albums' cover art and all its tracks, so
 * doing the albums first means MusicBrainz has filled in each `Album.mbid` before anything asks
 * the Archive for a cover. The overlap is cheap in the other direction — the track-level steps
 * are marker-driven, so Genius and Lyrics skip what the album pass already settled.
 */
export const ALBUM_TARGET = 'album:';
export const ARTIST_TARGET = 'artist:';

export function albumTarget(albumId: string): string {
  return `${ALBUM_TARGET}${albumId}`;
}

export function artistTarget(artistId: string): string {
  return `${ARTIST_TARGET}${artistId}`;
}

/**
 * "2 albums and 1 artist", so the confirmation says what it is about to touch.
 *
 * Derived from the target list rather than passed alongside it, so the two cannot disagree —
 * and it lives here rather than in the page because a module with JSX in it cannot be imported
 * by a test under this runner.
 */
export function describeTargets(targets: string[]): string {
  const albums = targets.filter((target) => target.indexOf(ALBUM_TARGET) === 0).length;
  const artists = targets.length - albums;
  const parts: string[] = [];
  if (albums) {
    parts.push(`${albums} album${albums === 1 ? '' : 's'}`);
  }
  if (artists) {
    parts.push(`${artists} artist${artists === 1 ? '' : 's'}`);
  }
  return parts.join(' and ');
}

/**
 * Runs `each` over every item, reporting into one monitor window.
 *
 * The window is the reason this is shared rather than three near-identical loops: a batch owns
 * it, and only the batch may finish it. Stopping is checked between items rather than between
 * steps — abandoning mid-album leaves it with an mbid and no cover art, which reads as a bug
 * rather than a cancellation.
 */
function runBatch<T>(
  items: T[],
  nameOf: (item: T) => string,
  each: (item: T, onStep: (step: string) => void, shared: SharedRun) => Promise<string[]>,
  onProgress?: (progress: BatchProgress) => void,
  stop?: () => boolean,
): Promise<{done: number; failed: string[]}> {
  const failed: string[] = [];
  let done = 0;
  const extensionId = startSharedRun();
  return items.reduce((chain, item, index) => chain.then(() => {
    if (stop && stop()) {
      return Promise.resolve();
    }
    const name = nameOf(item);
    return each(item, (step) => {
      if (onProgress) {
        onProgress({index: index + 1, name, step, total: items.length});
      }
    }, {extensionId, label: name}).then((stepsFailed) => {
      done++;
      stepsFailed.forEach((step) => {
        if (!failed.includes(step)) {
          failed.push(step);
        }
      });
    });
  }), Promise.resolve()).then(() => {
    finishSharedRun(extensionId, done, items.length, failed);
    return {done, failed};
  });
}

export function runAllForAlbums(
  albumIds: string[],
  onProgress?: (progress: BatchProgress) => void,
  stop?: () => boolean,
): Promise<{done: number; failed: string[]}> {
  return runBatch(albumIds, (albumId) => {
    const album = getAlbumById(reduxStore.getState(), albumId);
    return album ? album.name : albumId;
  }, (albumId, onStep, shared) => runAllForAlbum(albumId, onStep, shared), onProgress, stop);
}

/** The same over a list of artists, which also covers their albums and tracks. */
export function runAllForArtists(
  artistIds: string[],
  onProgress?: (progress: BatchProgress) => void,
  stop?: () => boolean,
): Promise<{done: number; failed: string[]}> {
  return runBatch(artistIds, (artistId) => {
    const artist = getArtistById(reduxStore.getState(), artistId);
    return artist ? artist.name : artistId;
  }, (artistId, onStep, shared) => runAllForArtist(artistId, onStep, shared), onProgress, stop);
}

export function runAllForTargets(
  targets: string[],
  onProgress?: (progress: BatchProgress) => void,
  stop?: () => boolean,
): Promise<{done: number; failed: string[]}> {
  return runBatch(targets, (target) => {
    const isAlbum = target.indexOf(ALBUM_TARGET) === 0;
    const id = target.slice((isAlbum ? ALBUM_TARGET : ARTIST_TARGET).length);
    const state = reduxStore.getState();
    const entity = isAlbum ? getAlbumById(state, id) : getArtistById(state, id);
    return entity ? entity.name : id;
  }, (target, onStep, shared) => {
    const isAlbum = target.indexOf(ALBUM_TARGET) === 0;
    const id = target.slice((isAlbum ? ALBUM_TARGET : ARTIST_TARGET).length);
    // Artists contribute only their own metadata here. The albums in the same batch already
    // cover their cover art and their tracks, so the full artist pass ran Genius and Lyrics a
    // second time over the very tracks that had just been done — and on an artist already in
    // the library it would sweep their whole back catalogue, which is not what importing an
    // album asks for.
    return isAlbum
      ? runAllForAlbum(id, onStep, shared)
      : runAllForArtist(id, onStep, shared, ARTIST_META_STEPS);
  }, onProgress, stop);
}
