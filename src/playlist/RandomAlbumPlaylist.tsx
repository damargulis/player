import Album from "../library/Album";
import EmptyPlaylist from "./EmptyPlaylist";

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

  public getCurrentAlbum(): Album {
    return this.playlist[this.currentAlbum];
  }

  public getCurrentTrack(): number | undefined {
    const album = this.getCurrentAlbum();
    if (!album || !album.trackIds[this.currentTrack]) {
      return undefined;
    }
    return album.trackIds[this.currentTrack];
  }

  public nextAlbum(): number | undefined {
    this.currentAlbum++;
    this.currentTrack = 0;
    if (this.playlist.length <= this.currentAlbum) {
      this.playlist.push(this.albums[Math.floor(Math.random() * this.albums.length)]);
    }
    return this.getCurrentTrack();
  }

  public nextTrack(): number | undefined {
    this.currentTrack++;
    if (!this.getCurrentTrack()) {
      return this.nextAlbum();
    }
    return this.getCurrentTrack();
  }

  public prevTrack(): number | undefined {
    this.currentTrack -= 1;
    if (!this.getCurrentTrack()) {
      this.currentAlbum--;
      this.currentTrack = this.getCurrentAlbum().trackIds.length - 1;
    }
    return this.getCurrentTrack();
  }

  public prevAlbum(): number | undefined {
    this.currentAlbum -= 1;
    this.currentTrack = 0;
    return this.getCurrentTrack();
  }

  public hasNextAlbum(): boolean {return true}

  public hasNextTrack(): boolean {return true}

  public hasPrevAlbum(): boolean {
    return this.currentAlbum > 0;
  }

  public hasPrevTrack(): boolean {
    return this.currentAlbum > 0 || this.currentTrack > 0;
  }

  public addAlbum(album: Album): void {
    this.playlist = this.playlist.slice(0, this.currentAlbum + 1);
    this.playlist.push(album);
  }
}
