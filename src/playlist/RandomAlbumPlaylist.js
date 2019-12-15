import EmptyPlaylist from './EmptyPlaylist';

export default class RandomAlbumPlaylist extends EmptyPlaylist {
  constructor(library, albums = []) {
    super();

    this.library_ = library;

    this.playlist_ = [];

    this.currentAlbum_ = -1;

    this.currentTrack_ = -1;

    this.albums_ = albums;
  }

  getCurrentAlbum() {
    return this.playlist_[this.currentAlbum_];
  }

  getCurrentTrack() {
    const album = this.getCurrentAlbum();
    if (!album || !album.trackIds[this.currentTrack_]) {
      return null;
    }
    return this.library_.getTrack(album.trackIds[this.currentTrack_]);
  }

  nextAlbum() {
    this.currentAlbum_++;
    this.currentTrack_ = 0;
    if (this.playlist_.length <= this.currentAlbum_) {
      if (this.albums_.length) {
        this.playlist_.push(this.albums_[
          Math.floor(Math.random() * this.albums_.length)]);
      } else {
        this.playlist_.push(this.library_.getRandomAlbum());
      }
    }
    return this.getCurrentTrack();
  }

  nextTrack() {
    this.currentTrack_++;
    if (!this.getCurrentTrack()) {
      return this.nextAlbum();
    }
    return this.getCurrentTrack();
  }

  prevTrack() {
    this.currentTrack_ -= 1;
    if (!this.getCurrentTrack()) {
      this.currentAlbum_--;
      this.currentTrack_ = this.getCurrentAlbum().trackIds.length - 1;
    }
    return this.getCurrentTrack();
  }

  prevAlbum() {
    this.currentAlbum_ -= 1;
    this.currentTrack_ = 0;
    return this.getCurrentTrack();
  }

  hasNextAlbum() {
    return true;
  }

  hasNextTrack() {
    return true;
  }

  hasPrevAlbum() {
    return this.currentAlbum_ > 0;
  }

  hasPrevTrack() {
    return this.currentAlbum_ > 0 || this.currentTrack_ > 0;
  }

  addAlbum(album) {
    this.playlist_ = this.playlist_.slice(0, this.currentAlbum_ + 1);
    this.playlist_.push(album);
  }
}

