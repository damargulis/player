import {Artist, LibraryInfo, Track} from '../../redux/actionTypes';
import {lookupRecording, RecordingResult, recordingUpdate} from './api';
import {runDelta, startRun} from '../delta';
import {ipcRenderer} from 'electron';
import {getArtistsByIds, getGenreIds, getTracksByIds} from '../../redux/selectors';
import shortid from 'shortid';
import {RootState} from '../../redux/store';
import {getPool} from '../utils';

/**
 * A recording's genres and first-release year onto one track. Only what the recording supplies
 * replaces anything, the same rule as the album run's.
 */
export function applyRecording(store: RootState, track: Track, recording: RecordingResult): boolean {
  const {genres, year} = recordingUpdate(recording);
  if (genres.length) {
    track.genreIds = getGenreIds(store, genres);
  }
  if (year) {
    track.year = year;
  }
  return genres.length > 0 || year !== undefined;
}

/**
 * MusicBrainz for individual tracks: each track's saved recording id (`Track.mbid`) is looked up
 * directly — one rate-limited request per track, no album search or tracklist match.
 *
 * The recording id is only learnt when the album run matches the album's tracklist one-to-one,
 * so a track without one is skipped and counted, and the summary says to run its album first.
 * That is also why the year is right for a song on several albums: a recording is the song, so
 * its first-release date is the song's, whatever album this copy came from. A compilation track
 * keeps the original year, which is not the album's, and that is intended.
 */
export default function runMusicBrainzTrackExtension(store: RootState, trackIds: string[],
                                                     sharedId?: string): PromiseLike<LibraryInfo> {
  const extensionId = sharedId || shortid.generate();
  const all = getTracksByIds(store, trackIds);
  const tracks = all.filter((track) => track.mbid);
  const unlinked = all.length - tracks.length;
  const start = startRun([], [], tracks, store.library.genres);
  let updated = 0;
  let failed = 0;
  const pool = getPool(
    store,
    tracks,
    /* prefix= */ 'track-',
    (track) => {
      const artist = getArtistsByIds(store, track.artistIds).map((data: Artist) => data.name).join(', ');
      return `${track.name} by: ${artist}`;
    },
    (poolStore: RootState, track: Track) => lookupRecording(track.mbid as string).then((recording) => {
      if (applyRecording(poolStore, track, recording)) {
        updated++;
      }
    }, () => {
      // one failed lookup never stops the rest; nothing is written for that track
      failed++;
    }),
    extensionId,
  );
  return pool.start().then(() => {
    const lines = [
      `MusicBrainz (tracks) completed.`,
      `${updated} of ${tracks.length} track${tracks.length === 1 ? '' : 's'} updated.`,
    ];
    if (failed) {
      lines.push(`${failed} lookup${failed === 1 ? '' : 's'} failed; run it again to retry them.`);
    }
    if (unlinked) {
      lines.push(`${unlinked} track${unlinked === 1 ? ' has' : 's have'} no MusicBrainz recording yet. ` +
        'Run MusicBrainz on their albums first: a recording is only known once the album matches.');
    }
    ipcRenderer.send('extension-update', {extensionId, msg: lines.join('<br>'), type: 'done'});
    return runDelta(start, [], [], tracks, store.library.genres);
  });
}
