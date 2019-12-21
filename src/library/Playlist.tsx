
export default class Playlist {
  public name: string;
  public trackIds: number[];

  constructor({name, trackIds}: {name: string, trackIds: number[]}) {
    this.name = name;
    this.trackIds = trackIds;
  }
}
