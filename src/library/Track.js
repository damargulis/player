
export default class Track {
  constructor(id, {
    name = '',
    duration = 0,
    filePath = '',
    year = 0,
    playCount = 0,
    skipCount = 0,
    artistIds = [],
    albumIds = [],
    genreIds = [],
    dateAdded = '',
    playDate = '',
  }) {
    /** @type {number} */
    this.id = id;

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

    /** @type {!Date} */
    this.dateAdded = new Date(dateAdded);

    /** @type {!Date} */
    this.playDate = new Date(playDate);
  }
}

