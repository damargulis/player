
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
    wikiPage = null,
    errors = [],
    warnings = {},
    favorites = [],
  }) {
    /** @type {string} */
    this.name = name;

    /** @type {!Array<number>} */
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

    /** @type {?string} */
    this.albumArtFile = albumArtFile;

    /** @type {?string} */
    this.wikiPage = wikiPage;

    // maybe make these into ids that can point to classes,
    // class then can have methods like getInfo, resolve, ignore etc.
    /** @type {!Array<string>} */
    this.errors = errors;

    // TODO: make this better idk
    this.warnings = warnings;

    /** @type {!Array<number>} */
    this.favorites = favorites;
  }

  /**
   * Adds an error, if it doesn't already exist.
   * @param {string} err The error string to add.
   */
  addError(err) {
    if (!this.errors.includes(err)) {
      this.errors.push(err);
    }
  }

  /**
   * Removes the error if the album currently has it.
   * @param {string} err The error string to remove.
   */
  removeError(err) {
    const index = this.errors.indexOf(err);
    if (index >= 0) {
      this.errors = [
        ...this.errors.slice(0, index),
        ...this.errors.slice(index + 1),
      ];
    }
  }

  addTrackWarning(index, trackTitles) {
    this.warnings[index] = trackTitles;
  }
}

