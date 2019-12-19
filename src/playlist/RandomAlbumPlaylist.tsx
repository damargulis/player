import Album from '../library/Album';
import Library from '../library/Library';
import EmptyPlaylist from './EmptyPlaylist';
import Track from '../library/Track';

export default class RandomAlbumPlaylist extends EmptyPlaylist {
  library: Library;
  playlist: Album[];
  currentAlbum: number;
  currentTrack: number;
  albums: Album[];

  constructor(library: Library, albums: Album[] = []) {
    super();
    this.library = library;
    this.playlist = [];
    this.currentAlbum = -1;
    this.currentTrack = -1;
    this.albums = albums;
  }

  getCurrentAlbum() {
    return this.playlist[this.currentAlbum];
  }

  getCurrentTrack(): Track | undefined{
    const album = this.getCurrentAlbum();
    if (!album || !album.trackIds[this.currentTrack]) {
      return undefined;
    }
    return this.library.getTrack(album.trackIds[this.currentTrack]);
  }

  nextAlbum() {
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

  nextTrack() {
    this.currentTrack++;
    if (!this.getCurrentTrack()) {
      return this.nextAlbum();
    }
    return this.getCurrentTrack();
  }

  prevTrack() {
    this.currentTrack -= 1;
    if (!this.getCurrentTrack()) {
      this.currentAlbum--;
      this.currentTrack = this.getCurrentAlbum().trackIds.length - 1;
    }
    return this.getCurrentTrack();
  }

  prevAlbum() {
    this.currentAlbum -= 1;
    this.currentTrack = 0;
    return this.getCurrentTrack();
  }

  hasNextAlbum() {
    return true;
  }

  hasNextTrack() {
    return true;
  }

  hasPrevAlbum() {
    return this.currentAlbum > 0;
  }

  hasPrevTrack() {
    return this.currentAlbum > 0 || this.currentTrack > 0;
  }

  addAlbum(album: Album) {
    this.playlist = this.playlist.slice(0, this.currentAlbum + 1);
    this.playlist.push(album);
  }
}

