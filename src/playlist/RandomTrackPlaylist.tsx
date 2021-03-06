import {Track} from '../redux/actionTypes';
import EmptyPlaylist from './EmptyPlaylist';

export default class RandomTrackPlaylist extends EmptyPlaylist {
  private tracks: Track[];
  private playlist: Track[];
  private currentTrack: number;
  constructor(tracks: Track[]) {
    super();
    this.tracks = tracks;
    this.playlist = [];
    this.currentTrack = -1;
  }

  public getCurrentTrack(): string | undefined {
    return this.playlist[this.currentTrack].id;
  }

  public nextTrack(): string | undefined {
    // TODO: switch to play through and reshuffle on repeat only
    this.currentTrack++;
    if (this.playlist.length <= this.currentTrack) {
      this.playlist.push(this.tracks[
        Math.floor(Math.random() * this.tracks.length)]);
    }
    return this.getCurrentTrack();
  }

  public prevTrack(): string | undefined {
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

  public addTrack(track: Track): void {
    this.playlist = this.playlist.slice(0, this.currentTrack + 1);
    this.playlist.push(track);
  }
}
