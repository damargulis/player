export default class RandomSongPlaylist {
  constructor(library) {
    this.library_ = library;

    this.playlist_ = [];

    this.currentTrack_ = -1;
  }

  getCurrentTrack() {
    return this.playlist_[this.currentTrack_];
  }

  nextTrack() {
    this.currentTrack_++;
    if (this.playlist_.length <= this.currentTrack_) {
      this.playlist_.push(this.library_.getRandomTrack());
    }
    return this.getCurrentTrack();
  }

  prevTrack() {
    this.currentTrack_--;
    return this.getCurrentTrack();
  }

  hasNextAlbum() {
    return false;
  }

  hasNextTrack() {
    return true;
  }

  hasPrevAlbum() {
    return false;
  }

  hasPrevTrack() {
    return this.currentTrack_ > 0;
  }

  addSong(song) {
    this.playlist_ = this.playlist_.slice(0, this.currentTrack_ + 1);
    this.playlist_.push(song);
  }

}
