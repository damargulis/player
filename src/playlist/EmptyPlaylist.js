
export default class EmptyPlaylist {
  getCurrentTrack() {
    return null;
  }

  hasNextTrack() {
    return false;
  }

  hasNextAlbum() {
    return false;
  }

  hasPrevTrack() {
    return false;
  }

  hasPrevAlbum() {
    return false;
  }

  addAlbum() {
    return null;
  }
}

