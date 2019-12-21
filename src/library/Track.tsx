export interface TrackParameters {
  duration?: number;
  playCount?: number;
  playDate?: string;
  filePath?: string;
  artistIds?: number[];
  albumIds?: number[];
  name?: string;
  year?: number;
  genreIds?: number[];
  skipCount?: number;
  dateAdded?: string;
  favorites?: number[];
}

export default class Track {
  public duration: number;
  public playCount: number;
  public playDate: Date;
  public filePath: string;
  public artistIds: number[];
  public albumIds: number[];
  public name: string;
  public year: number;
  public genreIds: number[];
  public id: number;
  public skipCount: number;
  public dateAdded: Date;
  public favorites: number[];

  constructor(id: number, {
    name = "",
    duration = 0,
    filePath = "",
    year = 0,
    playCount = 0,
    skipCount = 0,
    artistIds = [],
    albumIds = [],
    genreIds = [],
    dateAdded = "",
    playDate = "",
    favorites = [],
  }: TrackParameters) {
    this.id = id;
    this.name = name;
    this.duration = duration;
    this.filePath = filePath;
    this.year = year;
    this.playCount = playCount;
    this.skipCount = skipCount;
    this.artistIds = artistIds;
    this.albumIds = albumIds;
    this.genreIds = genreIds;
    this.dateAdded = new Date(dateAdded);
    this.playDate = new Date(playDate);
    this.favorites = favorites;
  }
}
