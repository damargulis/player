export interface PlaylistParameters {
  name: string;
  trackIds: number[];
}

export default class Playlist {
  public name: string;
  public trackIds: number[];

  constructor({ name, trackIds}: PlaylistParameters) {
    this.name = name;
    this.trackIds = trackIds;
  }
}
