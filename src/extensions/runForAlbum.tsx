import {Album, LibraryInfo, UPDATE_LIBRARY} from '../redux/actionTypes';
import runCoverArtExtension from './coverart/main';
import runGeniusExtension from './genius/main';
import runLyricsExtension from './lyrics/main';
import runMusicBrainzExtension from './musicbrainz/main';
import runWikiExtension from './wiki/main';
import {getAlbumById} from '../redux/selectors';
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
  run(album: Album): PromiseLike<unknown>;
}

const STEPS: RunStep[] = [
  {
    name: 'MusicBrainz',
    run: (album) => runMusicBrainzExtension([album.id], /* artistIds= */ [], reduxStore.getState()),
  },
  {
    name: 'Wikipedia',
    run: (album) => runWikiExtension([album.id], /* artistIds= */ [], reduxStore.getState()),
  },
  {
    name: 'Cover art',
    run: (album) => runCoverArtExtension(reduxStore.getState(), [album.id]),
  },
  {
    name: 'Genius',
    run: (album) => runGeniusExtension(reduxStore.getState(), album.trackIds),
  },
  {
    name: 'Lyrics',
    run: (album) => runLyricsExtension(reduxStore.getState(), album.trackIds),
  },
];

export function stepNames(): string[] {
  return STEPS.map((step) => step.name);
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
export default function runAllForAlbum(
  albumId: string,
  onStep?: (name: string) => void,
): Promise<string[]> {
  const failed: string[] = [];
  return STEPS.reduce((chain, step) => chain.then(() => {
    // read the album fresh: an earlier step may have given it the id this one needs
    const album = getAlbumById(reduxStore.getState(), albumId);
    if (!album) {
      return Promise.resolve();
    }
    if (onStep) {
      onStep(step.name);
    }
    return Promise.resolve(step.run(album)).then((updates) => {
      if (updates) {
        // the literal action rather than the creator, whose `type` widens to string
        reduxStore.dispatch({payload: {library: updates as LibraryInfo}, type: UPDATE_LIBRARY});
      }
    }, () => {
      failed.push(step.name);
    });
  }), Promise.resolve()).then(() => failed);
}
