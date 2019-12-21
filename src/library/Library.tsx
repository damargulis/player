import Album from "./Album";
import Artist from "./Artist";
import Playlist from "./Playlist";
import Track from "./Track";

import fs from "fs";

export default class Library {
  constructor(
    private tracks: Track[] = [],
    private albums: Album[] = [],
    private artists: Artist[] = [],
    private genres: string[] = [],
    private playlists: Playlist[] = [],
  ) {}

  public getAlbums(genres?: number[]) {
    if (genres && genres.length) {
      const albums = this.albums.filter((album) => {
        return album.genreIds.some((genreId) => {
          return genres.includes(genreId);
        });
      });
      return albums;
    }
    return this.albums;
  }

  public getAlbumsByArtist(artist: Artist) {
    return artist.albumIds.map((albumId) => {
      return this.albums[albumId];
    });
  }

  public getArtists(genres?: number[]) {
    if (genres && genres.length) {
      return this.artists.filter((artist) => {
        return artist.genreIds.some((genreId) => {
          return genres.includes(genreId);
        });
      });
    }
    return this.artists;
  }

  public getAlbumTracks(album: Album) {
    return album.trackIds.map((songId) => {
      return this.tracks[songId];
    });
  }

  public getTracks(genres?: number[]) {
    if (genres && genres.length) {
      return this.tracks.filter((song) => {
        return song.genreIds.some((genreId) => {
          return genres.includes(genreId);
        });
      });
    }
    return this.tracks;
  }

  public getAlbumById(id: number) {
    return this.albums[id];
  }

  public getAlbumsByIds(ids: number[]) {
    return ids.map((id) => this.getAlbumById(id));
  }

  public getArtistById(id: number) {
    return this.artists[id];
  }

  public getArtistsByIds(ids: number[]) {
    return ids.map((id) => this.getArtistById(id));
  }

  public getTrack(id: number) {
    return this.tracks[id];
  }

  public getTracksByIds(ids: number[]) {
    return ids.map((songId) => {
      return this.getTrack(songId);
    });
  }

  public getRandomAlbum() {
    return this.albums[Math.floor(Math.random() * this.albums.length)];
  }

  public getRandomTrack() {
    return this.tracks[Math.floor(Math.random() * this.tracks.length)];
  }

  public getGenres() {
    return this.genres;
  }

  public getGenreById(id: number) {
    return this.genres[id];
  }

  public getGenresByIds(ids: number[]) {
    return ids.map((id) => this.getGenreById(id));
  }

  /* adds any genres if they don't already exist. returns array of ids */
  public getGenreIds(genres: string[]) {
    return genres.map((genre) => {
      if (this.genres.indexOf(genre) >= 0) {
        return this.genres.indexOf(genre);
      }
      // push returns next index, -1 to return this one;
      return this.genres.push(genre) - 1;
    });
  }

  public save() {
    const fileName = "data/library.json";
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

  public getPlaylists() {
    return this.playlists;
  }
}
