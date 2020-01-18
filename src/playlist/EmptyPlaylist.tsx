
export default class EmptyPlaylist {
  public getCurrentTrack(): number | undefined {
    return undefined;
  }
  public nextAlbum(): number | undefined {
    return undefined;
  }
  public prevTrack(): number | undefined {
    return undefined;
  }
  public prevAlbum(): number | undefined {
    return undefined;
  }
  public nextTrack(): number | undefined {
    return undefined;
  }
  public hasPrevTrack(): boolean { return false; }
  public hasPrevAlbum(): boolean { return false; }
  public hasNextTrack(): boolean { return false; }
  public hasNextAlbum(): boolean { return false; }
}
