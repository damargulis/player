
export default class Playlist {
  name: string;
  trackIds: number[];

  constructor({name, trackIds}: {name: string, trackIds: number[]}) {
    this.name = name;
    this.trackIds = trackIds;
  }
}
