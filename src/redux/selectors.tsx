import Album from "../library/Album";
import Artist from "../library/Artist";
import Playlist from "../library/Playlist";
import {RootState} from "./store";
import Track from "../library/Track";

// TODO: SPLIT THIS UP!!!

export function getTime(store: RootState): number {
  return store.currentlyPlaying.time;
}

export function getAlbumById(store: RootState, albumId: number): Album {
  return store.library.albums[albumId];
}

export function getAlbumsByIds(store: RootState, albumIds: number[]): Album[] {
  return albumIds.map((id) => getAlbumById(store, id));
}

export function getAllAlbumIds(store: RootState): number[] {
  return store.library.albums.map((album) => album.id);
}

export function getAllArtistIds(store: RootState): number[] {
  return store.library.artists.map((artist) => artist.id);
}

export function getArtistById(store: RootState, artistId: number): Artist {
  return store.library.artists[artistId];
}

export function getArtistsByIds(store: RootState, artistIds: number[]): Artist[] {
  return artistIds.map((id) => getArtistById(store, id));
}

export function getGenres(store: RootState): string[] {
  return store.library.genres;
}

export function getGenreById(store: RootState, id: number): string {
  return getGenres(store)[id];
}

export function getGenresByIds(store: RootState, ids: number[]): string[] {
  return ids.map((id) => getGenreById(store, id));
}

export function getTrackById(store: RootState, id: number): Track {
  return store.library.tracks[id];
}

export function getTracksByIds(store: RootState, ids: number[]): Track[] {
  return ids.map((id) => getTrackById(store, id));
}

export function getGenreIds(store: RootState, genres: string[]): number[] {
  return genres.map((genre) => {
    if (store.library.genres.indexOf(genre) >= 0) {
      return store.library.genres.indexOf(genre);
    }
    // push returns next index, -1 to return this one;
    return store.library.genres.push(genre) - 1;
  });
}

export function getArtFilesByArtist(store: RootState, artist: Artist): string[] {
  const albums = getAlbumsByIds(store, artist.albumIds).map((album) => album.albumArtFile);
  return [
    artist.artFile,
    ...albums,
  ].filter(Boolean) as string[];
}

export function getAlbumsByGenres(store: RootState, genres: number[]): Album[] {
  return genres.length ? store.library.albums.filter((album) => {
    return album.genreIds.some((genreId) => {
      return genres.includes(genreId);
    });
  }) : store.library.albums;
}

export function getArtistsByGenres(store: RootState, genres: number[]): Artist[] {
  return genres.length ? store.library.artists.filter((artist) => {
    return artist.genreIds.some((genreId) => {
      return genres.includes(genreId);
    });
  }) : store.library.artists;
}

export function getTracksByGenres(store: RootState, genres: number[]): Track[] {
  return genres.length ? store.library.tracks.filter((track) => {
    return track.genreIds.some((genreId) => {
      return genres.includes(genreId);
    });
  }) : store.library.tracks;
}

export function getPlaylists(store: RootState): Playlist[] {
  return store.library.playlists;
}

/**
 * Gets the 100 most played songs in the library.
 */
function getMostPlayed(store: RootState): Playlist {
  const tracks = store.library.tracks.slice().sort((track1, track2) => {
    return track2.playCount - track1.playCount;
  }).slice(0, 100).map((track) => {
    return track.id;
  });
  return new Playlist({name: "Most Played", trackIds: tracks});
}

/**
 * Gets the unlistened songs in the library.
 */
function getUnlistened(store: RootState): Playlist {
  const tracks = store.library.tracks.filter((track) => {
    return track.playCount === 0;
  }).map((track) => {
    return track.id;
  });
  return new Playlist({name: "Unheard", trackIds: tracks});
}

const THREE_MONTHS = 1000 * 60 * 60 * 24;

/**
 * Gets the songs added to the library in the last 3 months.
 */
function getRecentlyAdded(store: RootState): Playlist {
  const now = new Date().getTime();
  const tracks = store.library.tracks.filter((track) => {
    return now - track.dateAdded.getTime() < THREE_MONTHS;
  }).map((track) => {
    return track.id;
  });
  return new Playlist({name: "Recently Added", trackIds: tracks});
}

/**
 * Gets the songs listened to in the last 3 months.
 */
function getRecentlyPlayed(store: RootState): Playlist {
  const now = new Date().getTime();
  const tracks = store.library.tracks.filter((track) => {
    return now - track.playDate.getTime() < THREE_MONTHS;
  }).map((track) => {
    return track.id;
  });
  return new Playlist({name: "Recently Played", trackIds: tracks});
}

/**
 * Gets playlist for likes in a given year.
 */
function getLikesForYear(store: RootState, year: number): Playlist {
  const tracks = store.library.tracks.filter((track) => {
    return track.favorites.indexOf(year) !== -1;
  }).map((track) => {
    return track.id;
  });
  return new Playlist({name: "Favorite Tracks of " + year, trackIds: tracks});
}

/**
 * Gets a playlist of songs liked in each year.
 */
function getLikesByYear(store: RootState): Playlist[] {
  const years = new Set<number>();
  store.library.tracks.forEach((track) => {
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
  const tracks = store.library.albums.filter((album) => {
    return album.favorites.indexOf(year) !== -1;
  }).map((album) => {
    return album.trackIds;
  }).flat();
  return new Playlist({name: "Favorite Albums of " + year, trackIds: tracks});
}

/**
 * Gets a playlist of albums liked in each year.
 */
function getAlbumLikesByYear(store: RootState): Playlist[] {
  const years = new Set<number>();
  store.library.albums.forEach((album) => {
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

export function getVolume(store: RootState): number {
  return store.currentlyPlaying.volume;
}
