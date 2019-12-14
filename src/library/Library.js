const fs = require('fs');
export default class Library {
  constructor(tracks, albums, artists, genres, playlists) {
    /** @private @const {!Array<Track>} */
    this.tracks_ = tracks || [];

    /** @private @const {!Array<!Album>} */
    this.albums_ = albums || [];

    /** @private @const {!Array<!Artist>} */
    this.artists_ = artists || [];

    /** @private @const {!Array<string>} */
    this.genres_ = genres || [];

    /** @private @const {!Array<Playlist} */
    this.playlists_ = playlists || [];
  }

  getAlbums(genres) {
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

  getAlbumsByArtist(artist) {
    return artist.albumIds.map((albumId) => {
      return this.albums_[albumId];
    });
  }

  getArtists(genres) {
    if (genres && genres.length) {
      return this.artists_.filter((artist) => {
        return artist.genreIds.some((genreId) => {
          return genres.includes(genreId);
        });
      });
    }
    return this.artists_;
  }

  getAlbumTracks(album) {
    return album.trackIds.map((songId) => {
      return this.tracks_[songId];
    });
  }

  getTracks(genres) {
    if (genres && genres.length) {
      return this.tracks_.filter((song) => {
        return song.genreIds.some((genreId) => {
          return genres.includes(genreId);
        });
      });
    }
    return this.tracks_;
  }

  getAlbumById(id) {
    return this.albums_[id];
  }

  getAlbumsByIds(ids) {
    return ids.map((id) => this.getAlbumById(id));
  }

  getArtistById(id) {
    return this.artists_[id];
  }

  getArtistsByIds(ids) {
    return ids.map((id) => this.getArtistById(id));
  }

  getTrack(id) {
    return this.tracks_[id];
  }

  getArtistTracks(artist) {
    return artist.trackIds.map((songId) => {
      return this.tracks_[songId];
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

  getGenreById(id) {
    return this.genres_[id];
  }

  getGenresByIds(ids) {
    return ids.map((id) => this.getGenreById(id));
  }

  /* adds any genres if they don't already exist. returns array of ids */
  getGenreIds(genres) {
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
      fs.writeFile(fileName, JSON.stringify(this), (err) => {
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
