
export default class Library {
  constructor(tracks, albums, artists, genres) {

    /** @private @const {!Array<Track>} */
    this.tracks_ = tracks || [];

    /** @private @const {!Array<!Album>} */
    this.albums_ = albums || [];

    /** @private @const {!Array<!Artist>} */
    this.artists_ = artists || [];

    /** @private @const {!Array<string>} */
    this.genres_ = genres || [];
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

  getAlbumsByIds(ids) {
    return ids.map((id) => this.albums_[id]);
  }

  getArtistsByIds(ids) {
    return ids.map((id) => this.artists_[id]);
  }

  getTrack(id) {
    return this.tracks_[id];
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

  getGenresByIds(ids) {
    return ids.map((id) => this.genres_[id]);
  }
}

