import EmptyPlaylist from "./EmptyPlaylist";
import Track from "../library/Track";

export default class RandomSongPlaylist extends EmptyPlaylist {
  private tracks: Track[];
  private playlist: Track[];
  private currentTrack: number;
  constructor(tracks: Track[]) {
    super();
    this.tracks = tracks;
    this.playlist = [];
    this.currentTrack = -1;
  }

  public getCurrentTrack() {
    return this.playlist[this.currentTrack];
  }

  public nextTrack() {
    // todo: switch to play through and reshuffle on repeat only
    this.currentTrack++;
    if (this.playlist.length <= this.currentTrack) {
      this.playlist.push(this.tracks[
        Math.floor(Math.random() * this.tracks.length)]);
    }
    return this.getCurrentTrack();
  }

  public prevTrack() {
    this.currentTrack--;
    return this.getCurrentTrack();
  }

  public hasNextAlbum() {
    return false;
  }

  public hasNextTrack() {
    return true;
  }

  public hasPrevAlbum() {
    return false;
  }

  public hasPrevTrack() {
    return this.currentTrack > 0;
  }

  public addSong(song: Track) {
    this.playlist = this.playlist.slice(0, this.currentTrack + 1);
    this.playlist.push(song);
  }
}
