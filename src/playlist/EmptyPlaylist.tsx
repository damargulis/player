
export default class EmptyPlaylist {
  public getCurrentTrack(): string | undefined {
    return undefined;
  }
  public nextAlbum(): string | undefined {
    return undefined;
  }
  public prevTrack(): string | undefined {
    return undefined;
  }
  public prevAlbum(): string | undefined {
    return undefined;
  }
  public nextTrack(): string | undefined {
    return undefined;
  }
  public hasPrevTrack(): boolean {
    return false;
  }
  public hasPrevAlbum(): boolean {
    return false;
  }
  public hasNextTrack(): boolean {
    return false;
  }
  public hasNextAlbum(): boolean {
    return false;
  }

  /**
   * Track ids already queued after the current one. Used when the DJ takes over so it can
   * inherit the queue instead of silently discarding it; lazily-generated queues report
   * only what they have actually committed to.
   */
  public getUpcoming(): string[] {
    return [];
  }
}
