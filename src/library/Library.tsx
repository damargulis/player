// TODO: DELTE THIS WHOLE DIRECTORY
import {AlbumParams, Artist, PlaylistParams, Track} from '../redux/actionTypes';

export default class Library {
  constructor(
    private tracks: Track[] = [],
    private albums: AlbumParams[] = [],
    private artists: Artist[] = [],
    private genres: string[] = [],
    private playlists: PlaylistParams[] = [],
  ) {}

  public getAlbums(): AlbumParams[] {
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

  public getPlaylists(): PlaylistParams[] {
    return this.playlists;
  }
}
