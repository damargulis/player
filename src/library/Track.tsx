
export default class Track {
  duration: number;
  playCount: number;
  playDate: Date;
  filePath: string;
  artistIds: number[];
  albumIds: number[];
  name: string;
  year: number;
  genreIds: number[];
  id: number;
  skipCount: number;
  dateAdded: Date;
  favorites: number[];

  constructor(id: number, {
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
    favorites = [],
  }) {
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

