import Track from '../library/Track';

export default class EmptyPlaylist {
  nextTrack() {}
  getCurrentTrack(): Track | undefined {
    return undefined;
  }
  nextAlbum(): Track | void {}
  prevTrack(): Track | void {}
  prevAlbum(): Track | void {}
  hasPrevTrack() { return false }
  hasPrevAlbum() { return false }
  hasNextTrack() { return false }
  hasNextAlbum() { return false }
}
