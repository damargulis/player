import Album from './Album';
import Artist from './Artist';
import Track from './Track';
import Playlist from './Playlist';

const fs = require('fs');

export default class Library {
  tracks_: Track[];
  albums_: Album[];
  artists_: Artist[];
  genres_: string[];
  playlists_: Playlist[];

  constructor(tracks: Track[] = [], albums: Album[] = [], artists: Artist[] = [], genres: string[] = [], playlists: Playlist[] = []) {
    this.tracks_ = tracks;
    this.albums_ = albums;
    this.artists_ = artists;
    this.genres_ = genres;
    this.playlists_ = playlists;
  }

  getAlbums(genres?: number[]) {
    if (genres && genres.length) {
      const albums = this.albums_.filter((album) => {
        return album.genreIds.some((genreId) => {
          return genres.includes(genreId);
        });
      });
      return albums;
    }
    return this.albums_;
  }

  getAlbumsByArtist(artist: Artist) {
    return artist.albumIds.map((albumId) => {
      return this.albums_[albumId];
    });
  }

  getArtists(genres?: number[]) {
    if (genres && genres.length) {
      return this.artists_.filter((artist) => {
        return artist.genreIds.some((genreId) => {
          return genres.includes(genreId);
        });
      });
    }
    return this.artists_;
  }

  getAlbumTracks(album: Album) {
    return album.trackIds.map((songId) => {
      return this.tracks_[songId];
    });
  }

  getTracks(genres?: number[]) {
    if (genres && genres.length) {
      return this.tracks_.filter((song) => {
        return song.genreIds.some((genreId) => {
          return genres.includes(genreId);
        });
      });
    }
    return this.tracks_;
  }

  getAlbumById(id: number) {
    return this.albums_[id];
  }

  getAlbumsByIds(ids: number[]) {
    return ids.map((id) => this.getAlbumById(id));
  }

  getArtistById(id: number) {
    return this.artists_[id];
  }

  getArtistsByIds(ids: number[]) {
    return ids.map((id) => this.getArtistById(id));
  }

  getTrack(id: number) {
    return this.tracks_[id];
  }

  getTracksByIds(ids: number[]) {
    return ids.map((songId) => {
      return this.getTrack(songId);
    });
  }

  getRandomAlbum() {
    return this.albums_[Math.floor(Math.random() * this.albums_.length)];
  }

  getRandomTrack() {
    return this.tracks_[Math.floor(Math.random() * this.tracks_.length)];
  }

  getGenres() {
    return this.genres_;
  }

  getGenreById(id: number) {
    return this.genres_[id];
  }

  getGenresByIds(ids: number[]) {
    return ids.map((id) => this.getGenreById(id));
  }

  /* adds any genres if they don't already exist. returns array of ids */
  getGenreIds(genres: string[]) {
    return genres.map((genre) => {
      if (this.genres_.indexOf(genre) >= 0) {
        return this.genres_.indexOf(genre);
      }
      // push returns next index, -1 to return this one;
      return this.genres_.push(genre) - 1;
    });
  }

  save() {
    const fileName = 'data/library.json';
    // maybe use sync if you want to do this on exit so it doesn't half write?
    // will have to see how exiting works on electron...
    return new Promise((resolve, reject) => {
      fs.writeFile(fileName, JSON.stringify(this), (err: Error|null) => {
        if (err) {
          reject(err);
        }
        return resolve();
      });
    });
  }

  getPlaylists() {
    return this.playlists_;
  }
}
