import Track from "../library/Track";

export default class EmptyPlaylist {
  public getCurrentTrack(): Track | undefined {
    return undefined;
  }
  public nextAlbum(): Track | undefined {
    return undefined;
  }
  public prevTrack(): Track | undefined {
    return undefined;
  }
  public prevAlbum(): Track | undefined {
    return undefined;
  }
  public nextTrack(): Track | undefined {
    return undefined;
  }
  public hasPrevTrack() { return false; }
  public hasPrevAlbum() { return false; }
  public hasNextTrack() { return false; }
  public hasNextAlbum() { return false; }
}
