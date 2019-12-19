import EmptyPlaylist from './EmptyPlaylist';
import Track from '../library/Track';

export default class RandomSongPlaylist extends EmptyPlaylist {
  tracks: Track[];
  playlist: Track[];
  currentTrack: number;
  constructor(tracks: Track[]) {
    super();
    this.tracks = tracks;
    this.playlist = [];
    this.currentTrack = -1;
  }

  getCurrentTrack() {
    return this.playlist[this.currentTrack];
  }

  nextTrack() {
    // todo: switch to play through and reshuffle on repeat only
    this.currentTrack++;
    if (this.playlist.length <= this.currentTrack) {
      this.playlist.push(this.tracks[
        Math.floor(Math.random() * this.tracks.length)]);
    }
    return this.getCurrentTrack();
  }

  prevTrack() {
    this.currentTrack--;
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
    return this.currentTrack > 0;
  }

  addSong(song: Track) {
    this.playlist = this.playlist.slice(0, this.currentTrack + 1);
    this.playlist.push(song);
  }
}
