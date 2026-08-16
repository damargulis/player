import TrackPlayer from 'react-native-track-player';
import defaultAlbumArt from '../assets/missing_album.png';

/** Shared local-playback helpers: queue building, play-from-track, shuffle, repeat. */

const PLAYER_OPTIONS = {
  capabilities: [
    TrackPlayer.CAPABILITY_PLAY,
    TrackPlayer.CAPABILITY_PAUSE,
    TrackPlayer.CAPABILITY_STOP,
    TrackPlayer.CAPABILITY_SEEK_TO,
    TrackPlayer.CAPABILITY_SKIP_TO_NEXT,
    TrackPlayer.CAPABILITY_SKIP_TO_PREVIOUS,
  ],

  compactCapabilities: [
    TrackPlayer.CAPABILITY_PLAY,
    TrackPlayer.CAPABILITY_PAUSE,
  ],
};

let repeatEnabled = false;

export function isRepeatEnabled(): boolean {
  return repeatEnabled;
}

export function setRepeatEnabled(value: boolean): void {
  repeatEnabled = value;
}

// restart the queue from the top when it runs out and repeat-all is on
TrackPlayer.addEventListener('playback-queue-ended', ({track}) => {
  if (!repeatEnabled || track == null) {
    return;
  }
  TrackPlayer.getQueue().then((queue) => {
    if (queue && queue.length) {
      TrackPlayer.skip(queue[0].id).then(() => TrackPlayer.play());
    }
  }).catch(() => {});
});

export function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function joinArtists(track, artists): string {
  return track.artistIds
    .map((artistId) => artists[artistId] && artists[artistId].name)
    .filter(Boolean)
    .join(', ');
}

function trackToPlayerData(trackId: string, library) {
  const track = library.tracks[trackId];
  const albumNames = track.albumIds
    .map((albumId) => library.albums[albumId] && library.albums[albumId].name)
    .filter(Boolean)
    .join(', ');
  const album = library.albums[track.albumIds[0]];
  const artwork = album && album.albumArtFile ? album.albumArtFile : defaultAlbumArt;
  return {
    id: track.id,
    url: track.filePath,
    title: track.name,
    artist: joinArtists(track, library.artists),
    album: albumNames,
    artwork,
  };
}

/**
 * Replaces the queue with the given tracks (skipping unsynced ones) and starts
 * playing — from startId if given, otherwise from the top.
 */
export async function playTracks(trackIds: string[], library, startId?: string): Promise<undefined> {
  const data = trackIds
    .filter((id) => library.tracks[id])
    .map((id) => trackToPlayerData(id, library));
  if (!data.length) {
    return;
  }
  await TrackPlayer.setupPlayer();
  await TrackPlayer.reset();
  await TrackPlayer.updateOptions(PLAYER_OPTIONS);
  await TrackPlayer.add(data);
  if (startId && library.tracks[startId]) {
    await TrackPlayer.skip(startId);
  }
  await TrackPlayer.play();
}

/** Reshuffles everything after the currently playing track. */
export async function shuffleUpcoming(): Promise<undefined> {
  const currentId = await TrackPlayer.getCurrentTrack();
  const queue = await TrackPlayer.getQueue();
  const index = queue.findIndex((t) => t.id === currentId);
  const upcoming = queue.slice(index + 1);
  if (!upcoming.length) {
    return;
  }
  shuffleArray(upcoming);
  await TrackPlayer.removeUpcomingTracks();
  await TrackPlayer.add(upcoming);
}
