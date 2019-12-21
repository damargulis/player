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
  public hasPrevTrack(): boolean { return false; }
  public hasPrevAlbum(): boolean { return false; }
  public hasNextTrack(): boolean { return false; }
  public hasNextAlbum(): boolean { return false; }
}
