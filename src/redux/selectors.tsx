import {Album, Artist, Genre, Playlist, Track, TrackWarning} from './actionTypes';
import {IS_DEV} from '../constants';
import shortid from 'shortid';
import {RootState} from './store';

export function getAllTracks(store: RootState): Track[] {
  return Object.values(store.library.tracks);
}

export function getTime(store: RootState): number {
  return store.currentlyPlaying.time;
}

export function getAlbumById(store: RootState, albumId: string): Album {
  return store.library.albums[albumId];
}

export function getAlbumsByIds(store: RootState, albumIds: string[]): Album[] {
  return albumIds.map((id) => getAlbumById(store, id));
}

export function getAllAlbumIds(store: RootState): string[] {
  return Object.keys(store.library.albums);
}

export function getAllArtistIds(store: RootState): string[] {
  return Object.keys(store.library.artists);
}

export function getArtistById(store: RootState, artistId: string): Artist {
  return store.library.artists[artistId];
}

export function getArtistsByIds(store: RootState, artistIds: string[]): Artist[] {
  return artistIds.map((id) => getArtistById(store, id));
}

export function getGenres(store: RootState): Genre[] {
  return Object.values(store.library.genres);
}

export function getAllGenreIds(store: RootState): string[] {
  return Object.keys(store.library.genres);
}

export function getGenreById(store: RootState, id: string): Genre {
  return store.library.genres[id];
}

export function getGenresByIds(store: RootState, ids: string[]): Genre[] {
  return ids.map((id) => getGenreById(store, id));
}

export function getTrackById(store: RootState, id: string): Track {
  return store.library.tracks[id];
}

export function getTracksByIds(store: RootState, ids: string[]): Track[] {
  return ids.map((id) => getTrackById(store, id));
}

export function getAllTrackIds(store: RootState): string[] {
  return Object.keys(store.library.tracks);
}

export function getGenreIds(store: RootState, genres: string[]): string[] {
  return genres.map((genre) => {
    const genreId = Object.keys(store.library.genres).find(key => store.library.genres[key].name === genre);
    if (genreId) {
      return genreId;
    }
    const newId = shortid.generate();
    // TODO: needs to be its own action...
    store.library.genres[newId.toString()] = {name: genre};
    return newId.toString();
  });
}

export function getArtFilesByArtist(store: RootState, artist: Artist): string[] {
  const albums = getAlbumsByIds(store, artist.albumIds).map((album) => album.albumArtFile);
  return [
    artist.artFile,
    ...albums,
  ].filter(Boolean) as string[];
}

export function getAlbumsByGenres(store: RootState, genres: string[]): Album[] {
  return genres.length ? Object.values(store.library.albums).filter((album) => {
    return album.genreIds.some((genreId) => {
      return genres.includes(genreId);
    });
  }) : Object.values(store.library.albums);
}

export function getArtistsByGenres(store: RootState, genres: string[]): Artist[] {
  return genres.length ? Object.values(store.library.artists).filter((artist) => {
    return artist.genreIds.some((genreId) => {
      return genres.includes(genreId);
    });
  }) : Object.values(store.library.artists);
}

export function getTracksByGenres(store: RootState, genres: string[]): Track[] {
  return genres.length ? getAllTracks(store).filter((track) => {
    return track.genreIds.some((genreId) => {
      return genres.includes(genreId);
    });
  }) : getAllTracks(store);
}

export function getPlaylists(store: RootState): Playlist[] {
  return Object.values(store.library.playlists);
}

/**
 * Gets the 100 most played tracks in the library.
 */
function getMostPlayed(store: RootState): Playlist {
  const tracks = getAllTracks(store).slice().sort((track1, track2) => {
    return track2.playCount - track1.playCount;
  }).slice(0, 100).map((track) => {
    return track.id;
  });
  return {name: 'Most Played', trackIds: tracks};
}

/**
 * Gets the unlistened tracks in the library.
 */
function getUnlistened(store: RootState): Playlist {
  const tracks = getAllTracks(store).filter((track) => {
    return track.playCount === 0;
  }).map((track) => {
    return track.id;
  });
  return {name: 'Unheard', trackIds: tracks};
}

const THREE_MONTHS = 1000 * 60 * 60 * 24 * 90;

/**
 * Gets the tracks added to the library in the last 3 months.
 */
function getRecentlyAdded(store: RootState): Playlist {
  const now = new Date().getTime();
  const tracks = getAllTracks(store).filter((track) => {
    return now - track.dateAdded.getTime() < THREE_MONTHS;
  }).map((track) => {
    return track.id;
  });
  return {name: 'Recently Added', trackIds: tracks};
}

/**
 * Gets the tracks listened to in the last 3 months.
 */
function getRecentlyPlayed(store: RootState): Playlist {
  const now = new Date().getTime();
  const tracks = getAllTracks(store).filter((track) => {
    return now - track.playDate.getTime() < THREE_MONTHS;
  }).map((track) => {
    return track.id;
  });
  return {name: 'Recently Played', trackIds: tracks};
}

/**
 * Gets playlist for likes in a given year.
 */
function getLikesForYear(store: RootState, year: number): Playlist {
  const tracks = getAllTracks(store).filter((track) => {
    return track.favorites.indexOf(year) !== -1;
  }).map((track) => {
    return track.id;
  });
  return {name: 'Favorite Tracks of ' + year, trackIds: tracks};
}

/**
 * Gets a playlist of tracks liked in each year.
 */
function getLikesByYear(store: RootState): Playlist[] {
  const years = new Set<number>();
  getAllTracks(store).forEach((track) => {
    track.favorites.forEach((year) => years.add(year));
  });
  return [...years].map((year) => {
    return getLikesForYear(store, year);
  });
}

/**
 * Gets playlist for album likes in a given year.
 */
function getAlbumLikesForYear(store: RootState, year: number): Playlist {
  const tracks = Object.values(store.library.albums).filter((album) => {
    return album.favorites.indexOf(year) !== -1;
  }).map((album) => {
    return album.trackIds;
  }).flat();
  return {name: 'Favorite Albums of ' + year, trackIds: tracks};
}

/**
 * Gets a playlist of albums liked in each year.
 */
function getAlbumLikesByYear(store: RootState): Playlist[] {
  const years = new Set<number>();
  Object.values(store.library.albums).forEach((album) => {
    album.favorites.forEach((year) => years.add(year));
  });
  return [...years].map((year) => {
    return getAlbumLikesForYear(store, year);
  });
}

export function getAutoPlaylists(store: RootState): Playlist[] {
  return [
    getMostPlayed(store),
    getUnlistened(store),
    getRecentlyAdded(store),
    getRecentlyPlayed(store),
    ...getLikesByYear(store),
    ...getAlbumLikesByYear(store),
  ];
}

export function getSyncedPlaylists(store: RootState): Playlist[] {
  if (IS_DEV) {
    const most = getMostPlayed(store);
    most.trackIds.splice(20);
    return [most];
  }
  return [
    getMostPlayed(store),
    ...getLikesByYear(store),
    ...getAlbumLikesByYear(store),
    getRecentlyAdded(store),
  ];
}

export function getVolume(store: RootState): number {
  return store.currentlyPlaying.volume;
}

export function getCurrentTrack(store: RootState): Track | undefined {
  return store.currentlyPlaying.currentlyPlayingId ?
    getTrackById(store, store.currentlyPlaying.currentlyPlayingId) : undefined;
}

export function getCurrentTrackId(store: RootState): string | undefined {
  return store.currentlyPlaying.currentlyPlayingId;
}

export function hasNextAlbum(store: RootState): boolean {
  return store.currentlyPlaying.playlist.hasNextAlbum();
}

export function hasNextTrack(store: RootState): boolean {
  return store.currentlyPlaying.playlist.hasNextTrack();
}

export function hasPrevAlbum(store: RootState): boolean {
  return store.currentlyPlaying.playlist.hasPrevAlbum();
}

export function hasPrevTrack(store: RootState): boolean {
  return store.currentlyPlaying.playlist.hasPrevTrack();
}

export function getIsPlaying(store: RootState): boolean {
  return store.currentlyPlaying.isPlaying;
}

export function getSetTime(store: RootState): number | undefined {
  return store.currentlyPlaying.setTime;
}

export function getNewTracks(store: RootState): Track[] {
  return store.library.newTracks.map((trackId) => {
    return store.library.tracks[trackId];
  });
}

export function getSelectedGenres(store: RootState): string[] {
  return store.settings.genres;
}

export function getWarningsFromAlbum(store: RootState, album?: Album): TrackWarning[] {
  if (!album) {
    return [];
  }
  const tracks = getTracksByIds(store, album.trackIds);
  return tracks.map((track) => track.warning || {});
}

export function getArtistByName(store: RootState, name: string): Artist | undefined {
  return Object.values(store.library.artists).find((artist) => artist.name === name);
}
