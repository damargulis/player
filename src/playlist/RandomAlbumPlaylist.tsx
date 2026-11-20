import {Album} from '../redux/actionTypes';
import EmptyPlaylist from './EmptyPlaylist';
import {keepKnown, SavedAlbumQueue} from './savedQueue';

export default class RandomAlbumPlaylist extends EmptyPlaylist {

  private playlist: Album[];
  private currentAlbum: number;
  private currentTrack: number;
  private albums: Album[];

  constructor(albums: Album[] = []) {
    super();
    this.playlist = [];
    this.currentAlbum = -1;
    this.currentTrack = -1;
    this.albums = albums;
  }
  /**
   * Rebuilds a saved shuffle against the library as it is now. Undefined when the album that was
   * playing no longer exists, and the caller starts a fresh shuffle instead.
   */
  public static fromSaved(saved: SavedAlbumQueue, albums: Record<string, Album>): RandomAlbumPlaylist | undefined {
    const {items, index} = keepKnown(saved.albumIds, saved.currentAlbum, (id) => id,
      (id) => !!albums[id] && albums[id].trackIds.length > 0);
    if (index < 0) {
      return undefined;
    }
    const playlist = new RandomAlbumPlaylist(Object.values(albums));
    playlist.playlist = items.map((id) => albums[id]);
    playlist.currentAlbum = index;
    const trackIndex = saved.currentTrackId ? playlist.playlist[index].trackIds.indexOf(saved.currentTrackId) : -1;
    playlist.currentTrack = Math.max(0, trackIndex);
    return playlist;
  }

  public getCurrentAlbum(): Album {
    return this.playlist[this.currentAlbum];
  }

  public getCurrentTrack(): string | undefined {
    const album = this.getCurrentAlbum();
    if (!album || !album.trackIds[this.currentTrack]) {
      return undefined;
    }
    return album.trackIds[this.currentTrack];
  }

  public nextAlbum(): string | undefined {
    this.currentAlbum++;
    this.currentTrack = 0;
    if (this.playlist.length <= this.currentAlbum) {
      this.playlist.push(this.albums[Math.floor(Math.random() * this.albums.length)]);
    }
    return this.getCurrentTrack();
  }

  public nextTrack(): string | undefined {
    this.currentTrack++;
    if (!this.getCurrentTrack()) {
      return this.nextAlbum();
    }
    return this.getCurrentTrack();
  }

  public prevTrack(): string | undefined {
    this.currentTrack -= 1;
    if (!this.getCurrentTrack()) {
      this.currentAlbum--;
      this.currentTrack = this.getCurrentAlbum().trackIds.length - 1;
    }
    return this.getCurrentTrack();
  }

  public prevAlbum(): string | undefined {
    this.currentAlbum -= 1;
    this.currentTrack = 0;
    return this.getCurrentTrack();
  }

  public hasNextAlbum(): boolean {
    return true;
  }

  public hasNextTrack(): boolean {
    return true;
  }

  public hasPrevAlbum(): boolean {
    return this.currentAlbum > 0;
  }

  public hasPrevTrack(): boolean {
    return this.currentAlbum > 0 || this.currentTrack > 0;
  }

  /** The rest of the album now playing; later albums are random, so they aren't committed yet. */
  public getUpcoming(): string[] {
    const album = this.getCurrentAlbum();
    if (!album) {
      return [];
    }
    return album.trackIds.slice(this.currentTrack + 1);
  }

  public save(): SavedAlbumQueue | undefined {
    if (!this.getCurrentAlbum()) {
      return undefined;
    }
    return {
      albumIds: this.playlist.map((album) => album.id),
      currentAlbum: this.currentAlbum,
      currentTrackId: this.getCurrentTrack(),
      kind: 'album',
    };
  }

  public addAlbum(album: Album): void {
    this.playlist = this.playlist.slice(0, this.currentAlbum + 1);
    this.playlist.push(album);
  }
}
