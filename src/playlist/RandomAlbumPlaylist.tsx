import Album from "../library/Album";
import EmptyPlaylist from "./EmptyPlaylist";
import Library from "../library/Library";
import Track from "../library/Track";

export default class RandomAlbumPlaylist extends EmptyPlaylist {
  private library: Library;
  private playlist: Album[];
  private currentAlbum: number;
  private currentTrack: number;
  private albums: Album[];

  constructor(library: Library, albums: Album[] = []) {
    super();
    this.library = library;
    this.playlist = [];
    this.currentAlbum = -1;
    this.currentTrack = -1;
    this.albums = albums;
  }

  public getCurrentAlbum(): Album {
    return this.playlist[this.currentAlbum];
  }

  public getCurrentTrack(): Track | undefined {
    const album = this.getCurrentAlbum();
    if (!album || !album.trackIds[this.currentTrack]) {
      return undefined;
    }
    return this.library.getTrack(album.trackIds[this.currentTrack]);
  }

  public nextAlbum(): Track | undefined {
    this.currentAlbum++;
    this.currentTrack = 0;
    if (this.playlist.length <= this.currentAlbum) {
      if (this.albums.length) {
        this.playlist.push(this.albums[
          Math.floor(Math.random() * this.albums.length)]);
      } else {
        this.playlist.push(this.library.getRandomAlbum());
      }
    }
    return this.getCurrentTrack();
  }

  public nextTrack(): Track | undefined {
    this.currentTrack++;
    if (!this.getCurrentTrack()) {
      return this.nextAlbum();
    }
    return this.getCurrentTrack();
  }

  public prevTrack(): Track | undefined {
    this.currentTrack -= 1;
    if (!this.getCurrentTrack()) {
      this.currentAlbum--;
      this.currentTrack = this.getCurrentAlbum().trackIds.length - 1;
    }
    return this.getCurrentTrack();
  }

  public prevAlbum(): Track | undefined {
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

  public addAlbum(album: Album): void {
    this.playlist = this.playlist.slice(0, this.currentAlbum + 1);
    this.playlist.push(album);
  }
}
