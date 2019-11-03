
export default class Playlist {
  constructor({name, trackIds}) {
    /** @string */
    this.name = name;

    /** {!Array<number>} */
    this.trackIds = trackIds;
  }
}
