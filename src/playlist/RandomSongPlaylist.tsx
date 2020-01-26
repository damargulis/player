import {TrackParams} from '../redux/actionTypes';
import EmptyPlaylist from './EmptyPlaylist';

export default class RandomSongPlaylist extends EmptyPlaylist {
  private tracks: TrackParams[];
  private playlist: TrackParams[];
  private currentTrack: number;
  constructor(tracks: TrackParams[]) {
    super();
    this.tracks = tracks;
    this.playlist = [];
    this.currentTrack = -1;
  }

  public getCurrentTrack(): number | undefined {
    return this.playlist[this.currentTrack].id;
  }

  public nextTrack(): number | undefined {
    // TODO: switch to play through and reshuffle on repeat only
    this.currentTrack++;
    if (this.playlist.length <= this.currentTrack) {
      this.playlist.push(this.tracks[
        Math.floor(Math.random() * this.tracks.length)]);
    }
    return this.getCurrentTrack();
  }

  public prevTrack(): number | undefined {
    this.currentTrack--;
    return this.getCurrentTrack();
  }

  public hasNextAlbum(): boolean {
    return false;
  }

  public hasNextTrack(): boolean {
    return true;
  }

  public hasPrevAlbum(): boolean {
    return false;
  }

  public hasPrevTrack(): boolean {
    return this.currentTrack > 0;
  }

  public addSong(song: TrackParams): void {
    this.playlist = this.playlist.slice(0, this.currentTrack + 1);
    this.playlist.push(song);
  }
}
