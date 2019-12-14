export default class Artist {
  constructor(id, {
    name = '',
    albumIds = [],
    trackIds = [],
    genreIds = [],
    errors = [],
    artFile = null,
    wikiPage = null,
  }) {
    /** @type {number} */
    this.id = id;

    /** @type {string} */
    this.name = name;

    /** @type {!Array<number>} */
    this.albumIds = albumIds;

    /** @type {!Array<number>} */
    this.trackIds = trackIds;

    /** @type {!Array<number>} */
    this.genreIds = genreIds;

    /** @type {!Array<string>} */
    this.errors = errors;

    /** @type {?string} */
    this.artFile = artFile;

    /** @type {?string} */
    this.wikiPage = wikiPage;
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
}

