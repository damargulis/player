
export default class Album {
  public id: number;
  public warnings: Record<string, string>;
  public errors: string[];
  public albumArtFile?: string;
  public artistIds: number[];
  public name: string;
  public trackIds: number[];
  public year: number;
  public wikiPage?: string;
  public genreIds: number[];
  public playCount: number;
  public skipCount: number;
  public favorites: number[];

  constructor(id: number, {
    name = "",
    trackIds = [],
    genreIds = [],
    artistIds = [],
    year = 0,
    playCount = 0,
    skipCount = 0,
    albumArtFile = undefined,
    wikiPage = undefined,
    errors = [],
    warnings = {},
    favorites = [],
  }) {
    this.id = id;
    this.name = name;
    this.trackIds = trackIds;
    this.genreIds = genreIds;
    this.artistIds = artistIds;
    this.year = year;
    this.playCount = playCount;
    this.skipCount = skipCount;
    this.albumArtFile = albumArtFile;
    this.wikiPage = wikiPage;
    // maybe make these into ids that can point to classes,
    // class then can have methods like getInfo, resolve, ignore etc.
    this.errors = errors;
    // TODO: make this better idk
    this.warnings = warnings;
    this.favorites = favorites;
  }

  public addError(err: string) {
    if (!this.errors.includes(err)) {
      this.errors.push(err);
    }
  }

  public removeError(err: string) {
    const index = this.errors.indexOf(err);
    if (index >= 0) {
      this.errors = [
        ...this.errors.slice(0, index),
        ...this.errors.slice(index + 1),
      ];
    }
  }

  public addTrackWarning(index: number, trackTitles: string) {
    this.warnings[index] = trackTitles;
  }
}
