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

  public getAlbums(genres?: number[]): Album[] {
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

  public getAlbumsByArtist(artist: Artist): Album[] {
    return artist.albumIds.map((albumId) => {
      return this.albums[albumId];
    });
  }

  public getArtists(genres?: number[]): Artist[] {
    if (genres && genres.length) {
      return this.artists.filter((artist) => {
        return artist.genreIds.some((genreId) => {
          return genres.includes(genreId);
        });
      });
    }
    return this.artists;
  }

  public getAlbumTracks(album: Album): Track[] {
    return album.trackIds.map((songId) => {
      return this.tracks[songId];
    });
  }

  public getTracks(genres?: number[]): Track[] {
    if (genres && genres.length) {
      return this.tracks.filter((song) => {
        return song.genreIds.some((genreId) => {
          return genres.includes(genreId);
        });
      });
    }
    return this.tracks;
  }

  public getAlbumById(id: number): Album {
    return this.albums[id];
  }

  public getAlbumsByIds(ids: number[]): Album[] {
    return ids.map((id) => this.getAlbumById(id));
  }

  public getArtistById(id: number): Artist {
    return this.artists[id];
  }

  public getArtistsByIds(ids: number[]): Artist[] {
    return ids.map((id) => this.getArtistById(id));
  }

  public getTrack(id: number): Track {
    return this.tracks[id];
  }

  public getTracksByIds(ids: number[]): Track[] {
    return ids.map((songId) => {
      return this.getTrack(songId);
    });
  }

  public getRandomAlbum(): Album {
    return this.albums[Math.floor(Math.random() * this.albums.length)];
  }

  public getRandomTrack(): Track {
    return this.tracks[Math.floor(Math.random() * this.tracks.length)];
  }

  public getGenres(): string[] {
    return this.genres;
  }

  public getGenreById(id: number): string {
    return this.genres[id];
  }

  public getGenresByIds(ids: number[]): string[] {
    return ids.map((id) => this.getGenreById(id));
  }

  /* adds any genres if they don't already exist. returns array of ids */
  public getGenreIds(genres: string[]): number[] {
    return genres.map((genre) => {
      if (this.genres.indexOf(genre) >= 0) {
        return this.genres.indexOf(genre);
      }
      // push returns next index, -1 to return this one;
      return this.genres.push(genre) - 1;
    });
  }

  public save(): Promise<void> {
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

  public getPlaylists(): Playlist[] {
    return this.playlists;
  }
}
