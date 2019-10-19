
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

  getAlbumsByIds(ids) {
    return ids.map((id) => this.albums_[id]);
  }

  getArtistsByIds(ids) {
    return ids.map((id) => this.artists_[id]);
  }

  getTracks() {
    return this.tracks_;
  }

  getTrack(id) {
    return this.tracks_[id];
  }

  getRandomAlbum() {
    return this.albums_[Math.floor(Math.random() * this.albums_.length)];
  }

  getGenres() {
    return this.genres_;
  }
}

