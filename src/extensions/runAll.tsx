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
const ARTIST_STEPS: Array<{name: string;
  run(artist: Artist, extensionId: string): PromiseLike<unknown>; }> = [
  {
    name: 'MusicBrainz',
    run: (artist, id) => runMusicBrainzExtension(/* albumIds= */ [], [artist.id],
      reduxStore.getState(), id),
  },
  {
    name: 'Wikipedia',
    run: (artist, id) => runWikiExtension(/* albumIds= */ [], [artist.id], reduxStore.getState(), id),
  },
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

/**
 * Runs each extension in turn, dispatching its delta before the next starts.
 *
 * `onStep` reports what is running, because the whole sequence is minutes of work on an album
 * with no metadata and a button that sits there is indistinguishable from one that failed.
 *
 * A step that throws does not stop the rest: these are five unrelated services, and Genius
 * being rate-limited is no reason to skip the lyrics. Failures are collected and returned.
 */
function runSteps<T>(
  steps: Array<{name: string; run(entity: T, extensionId: string): PromiseLike<unknown>}>,
  lookup: () => T | undefined,
  onStep?: (name: string) => void,
): Promise<string[]> {
  const failed: string[] = [];
  // One id for the whole run, so the five extensions report into one monitor window instead
  // of opening five. `group` tells the monitor how many summaries to expect before it offers
  // the Done button.
  const extensionId = shortid.generate();
  ipcRenderer.send('extension-update', {extensionId, steps: steps.length, type: 'group'});
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
      msg: `${step.name} (${index + 1} of ${steps.length})`,
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

export default function runAllForAlbum(
  albumId: string,
  onStep?: (name: string) => void,
): Promise<string[]> {
  return runSteps(STEPS, () => getAlbumById(reduxStore.getState(), albumId), onStep);
}

export function runAllForArtist(
  artistId: string,
  onStep?: (name: string) => void,
): Promise<string[]> {
  return runSteps(ARTIST_STEPS, () => getArtistById(reduxStore.getState(), artistId), onStep);
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
export function runAllForAlbums(
  albumIds: string[],
  onProgress?: (progress: BatchProgress) => void,
  stop?: () => boolean,
): Promise<{done: number; failed: string[]}> {
  const failed: string[] = [];
  let done = 0;
  return albumIds.reduce((chain, albumId, index) => chain.then(() => {
    if (stop && stop()) {
      return Promise.resolve();
    }
    const album = getAlbumById(reduxStore.getState(), albumId);
    const name = album ? album.name : albumId;
    return runAllForAlbum(albumId, (step) => {
      if (onProgress) {
        onProgress({index: index + 1, name, step, total: albumIds.length});
      }
    }).then((stepsFailed) => {
      done++;
      stepsFailed.forEach((step) => {
        if (!failed.includes(step)) {
          failed.push(step);
        }
      });
    });
  }), Promise.resolve()).then(() => ({done, failed}));
}

/** The same over a list of artists, which also covers their albums and tracks. */
export function runAllForArtists(
  artistIds: string[],
  onProgress?: (progress: BatchProgress) => void,
  stop?: () => boolean,
): Promise<{done: number; failed: string[]}> {
  const failed: string[] = [];
  let done = 0;
  return artistIds.reduce((chain, artistId, index) => chain.then(() => {
    if (stop && stop()) {
      return Promise.resolve();
    }
    const artist = getArtistById(reduxStore.getState(), artistId);
    const name = artist ? artist.name : artistId;
    return runAllForArtist(artistId, (step) => {
      if (onProgress) {
        onProgress({index: index + 1, name, step, total: artistIds.length});
      }
    }).then((stepsFailed) => {
      done++;
      stepsFailed.forEach((step) => {
        if (!failed.includes(step)) {
          failed.push(step);
        }
      });
    });
  }), Promise.resolve()).then(() => ({done, failed}));
}
