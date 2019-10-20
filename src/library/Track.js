
export default class Track {
  constructor({
    name = '',
    duration = 0,
    filePath = '',
    year = 0,
    playCount = 0,
    skipCount = 0,
    artistIds = [],
    albumIds = [],
    genreIds = [],
  }) {

    /** @type {string} */
    this.name = name;

    /** @type {number} */
    this.duration = duration;

    /** @type {string} */
    this.filePath = filePath;

    /** @type {number} */
    this.year = year;

    /** @type {number} */
    this.playCount = playCount;

    /** @type {number} */
    this.skipCount = skipCount;

    /** @type {!Array<number>} */
    this.artistIds = artistIds;

    /** @type {!Array<number>} */
    this.albumIds = albumIds;

    /** @type {!Array<number>} */
    this.genreIds = genreIds;
  }
}

