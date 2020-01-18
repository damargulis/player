import Album from './Album';
import Artist from './Artist';
import {DATA_DIR} from '../constants';
import Playlist from './Playlist';
import Track from './Track';

import fs from 'fs';

export default class Library {
  constructor(
    private tracks: Track[] = [],
    private albums: Album[] = [],
    private artists: Artist[] = [],
    private genres: string[] = [],
    private playlists: Playlist[] = [],
  ) {}

  public getAlbums(): Album[] {
    return this.albums;
  }

  public getArtists(): Artist[] {
    return this.artists;
  }

  public getTracks(): Track[] {
    return this.tracks;
  }

  public getGenres(): string[] {
    return this.genres;
  }

  public getPlaylists(): Playlist[] {
    return this.playlists;
  }

  public save(): Promise<void> {
    const fileName = `${DATA_DIR}/library.json`;
    // maybe use sync if you want to do this on exit so it doesn't half write?
    // will have to see how exiting works on electron...
    return new Promise((resolve, reject) => {
      fs.writeFile(fileName, JSON.stringify(this), (err: Error | null) => {
        if (err) {
          reject(err);
        }
        return resolve();
      });
    });
  }
}
