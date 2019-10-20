export default class Artist {
  constructor({
    name = '',
    albumIds = [],
    trackIds = [],
    genreIds = [],
  }) {

    /** @type {string} */
    this.name = name;

    /** @type {!Array<number>} */
    this.albumIds = albumIds;

    /** @type {!Array<number>} */
    this.trackIds = trackIds;

    /** @type {!Array<number>} */
    this.genreIds = genreIds;
  }
}

