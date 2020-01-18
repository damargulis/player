export interface ArtistParameters {
  name?: string;
  albumIds?: number[];
  artFile?: string;
  errors?: string[];
  wikiPage?: string;
  genreIds?: number[];
  trackIds?: number[];
}

export default class Artist {
  public name: string;
  public albumIds: number[];
  public artFile?: string;
  public id: number;
  public errors: string[];
  public wikiPage?: string;
  public genreIds: number[];
  public trackIds: number[];

  constructor(id: number, {
    name = '',
    albumIds = [],
    trackIds = [],
    genreIds = [],
    errors = [],
    artFile = undefined,
    wikiPage = undefined,
  }: ArtistParameters) {
    this.id = id;
    this.name = name;
    this.albumIds = albumIds;
    this.trackIds = trackIds;
    this.genreIds = genreIds;
    this.errors = errors;
    this.artFile = artFile;
    this.wikiPage = wikiPage;
  }

  public addError(err: string): void {
    if (!this.errors.includes(err)) {
      this.errors.push(err);
    }
  }

  public removeError(err: string): void {
    const index = this.errors.indexOf(err);
    if (index >= 0) {
      this.errors = [
        ...this.errors.slice(0, index),
        ...this.errors.slice(index + 1),
      ];
    }
  }
}
