export default class Artist {
  name: string;
  albumIds: number[];
  artFile?: string;
  id: number;
  errors: string[];
  wikiPage?: string;
  genreIds: number[];
  trackIds: number[];

  constructor(id: number, {
    name = '',
    albumIds = [],
    trackIds = [],
    genreIds = [],
    errors = [],
    artFile = undefined,
    wikiPage = undefined,
  }) {
    this.id = id;
    this.name = name;
    this.albumIds = albumIds;
    this.trackIds = trackIds;
    this.genreIds = genreIds;
    this.errors = errors;
    this.artFile = artFile;
    this.wikiPage = wikiPage;
  }

  addError(err: string) {
    if (!this.errors.includes(err)) {
      this.errors.push(err);
    }
  }

  removeError(err: string) {
    const index = this.errors.indexOf(err);
    if (index >= 0) {
      this.errors = [
        ...this.errors.slice(0, index),
        ...this.errors.slice(index + 1),
      ];
    }
  }
}

