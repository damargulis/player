
export default class Album {
  constructor({
    name = '',
    trackIds = [],
    genreIds = [],
    artistIds = [],
    year = 0,
    playCount = 0,
    skipCount = 0,
    albumArtFile = null,
  }) {
    /** @type {string} */
    this.name = name;

    /** @type {!Array<nunmber>} */
    this.trackIds = trackIds;

    /** @type {!Array<nunmber>} */
    this.genreIds = genreIds;

    /** @type {!Array<number>} */
    this.artistIds = artistIds;

    /** @type {number} */
    this.year = year;

    /** @type {number} */
    this.playCount = playCount;

    /** @type {number} */
    this.skipCount = skipCount;

    /** @type {string} */
    this.albumArtFile = albumArtFile;
  }
}

