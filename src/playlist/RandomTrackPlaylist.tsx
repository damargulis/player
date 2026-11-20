import {Track} from '../redux/actionTypes';
import EmptyPlaylist from './EmptyPlaylist';
import {keepKnown, SavedTrackQueue} from './savedQueue';

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
  /** Undefined when the track that was playing no longer exists. */
  public static fromSaved(saved: SavedTrackQueue, tracks: Record<string, Track>): RandomTrackPlaylist | undefined {
    const {items, index} = keepKnown(saved.trackIds, saved.current, (id) => id, (id) => !!tracks[id]);
    if (index < 0) {
      return undefined;
    }
    const pool = saved.poolIds.filter((id) => !!tracks[id]).map((id) => tracks[id]);
    const playlist = new RandomTrackPlaylist(pool.length ? pool : Object.values(tracks));
    playlist.playlist = items.map((id) => tracks[id]);
    playlist.currentTrack = index;
    return playlist;
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

  /** Only tracks already committed to the queue; the rest are generated on demand. */
  public getUpcoming(): string[] {
    return this.playlist.slice(this.currentTrack + 1).map((track) => track.id);
  }

  public save(): SavedTrackQueue | undefined {
    if (!this.playlist[this.currentTrack]) {
      return undefined;
    }
    return {
      current: this.currentTrack,
      kind: 'track',
      poolIds: this.tracks.map((track) => track.id),
      trackIds: this.playlist.map((track) => track.id),
    };
  }

  public addTrack(track: Track): void {
    this.playlist = this.playlist.slice(0, this.currentTrack + 1);
    this.playlist.push(track);
  }
}
