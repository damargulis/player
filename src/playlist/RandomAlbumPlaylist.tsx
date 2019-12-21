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

  public getCurrentAlbum() {
    return this.playlist[this.currentAlbum];
  }

  public getCurrentTrack(): Track | undefined {
    const album = this.getCurrentAlbum();
    if (!album || !album.trackIds[this.currentTrack]) {
      return undefined;
    }
    return this.library.getTrack(album.trackIds[this.currentTrack]);
  }

  public nextAlbum() {
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

  public nextTrack() {
    this.currentTrack++;
    if (!this.getCurrentTrack()) {
      return this.nextAlbum();
    }
    return this.getCurrentTrack();
  }

  public prevTrack() {
    this.currentTrack -= 1;
    if (!this.getCurrentTrack()) {
      this.currentAlbum--;
      this.currentTrack = this.getCurrentAlbum().trackIds.length - 1;
    }
    return this.getCurrentTrack();
  }

  public prevAlbum() {
    this.currentAlbum -= 1;
    this.currentTrack = 0;
    return this.getCurrentTrack();
  }

  public hasNextAlbum() {
    return true;
  }

  public hasNextTrack() {
    return true;
  }

  public hasPrevAlbum() {
    return this.currentAlbum > 0;
  }

  public hasPrevTrack() {
    return this.currentAlbum > 0 || this.currentTrack > 0;
  }

  public addAlbum(album: Album) {
    this.playlist = this.playlist.slice(0, this.currentAlbum + 1);
    this.playlist.push(album);
  }
}
