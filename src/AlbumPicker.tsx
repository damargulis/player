import Album from "./library/Album";
import AlbumInfo from "./AlbumInfo";
import Artist from "./library/Artist";
import Library from "./library/Library";
import RandomAlbumPlaylist from "./playlist/RandomAlbumPlaylist";
import * as React from "react";
import SearchBar from "./SearchBar";
import WrappedGrid from "./WrappedGrid";

import "./App.css";

interface AlbumPickerProps {
  albums: Album[];
  library: Library;
  goToAlbum(album: Album): void;
  setPlaylistAndPlay(playlist: RandomAlbumPlaylist): void;
}

interface AlbumPickerState {
  search?: string;
  reverse: boolean;
  sortedAlbums: Album[];
  withErrors: boolean;
  sortMethod(album1: Album, album2: Album): number;
}

export default class AlbumPicker extends React.Component<AlbumPickerProps, AlbumPickerState> {
  private numCols: number;

  constructor(props: AlbumPickerProps) {
    super(props);

    this.sortByName = this.sortByName.bind(this);
    this.sortByYear = this.sortByYear.bind(this);
    this.sortByArtist = this.sortByArtist.bind(this);

    this.state = {
      reverse: false,
      search: undefined,
      sortMethod: this.sortByName,
      sortedAlbums: [],
      withErrors: false,
    };
    this.numCols = 0;
  }

  public sortAlbums(albums: Album[]): Album[] {
    return albums.filter((album) => {
      if (!this.state.search) {
        return true;
      }
      return album.name.includes(this.state.search);
    }).sort((album1, album2) => {
      if (this.state.reverse) {
        return this.state.sortMethod(album2, album1);
      }
      return this.state.sortMethod(album1, album2);
    });
  }

  public componentDidMount(): void {
    this.setState({
      sortedAlbums: this.sortAlbums(this.props.albums),
    });
  }

  public componentDidUpdate(): void {
    const sortedAlbums = this.sortAlbums(this.props.albums);
    if (sortedAlbums.length !== this.state.sortedAlbums.length ||
      sortedAlbums.some((album, index) => {
        return this.state.sortedAlbums[index] !== album;
      })) {
      this.setState({
        sortedAlbums,
      });
    }
  }

  public render(): JSX.Element {
    const items = this.state.withErrors
      ? this.state.sortedAlbums.filter((album: Album) => {
        return album.errors.length > 0;
      }) : this.state.sortedAlbums;
    return (
      <div className="main" >
        <div id="sortPicker" style={{textAlign: "center"}}>
          <button onClick={() => this.chooseSort(this.sortByName)}>Name</button>
          <button onClick={() => this.chooseSort(this.sortByArtist)}>Artist
          </button>
          <button onClick={() => this.chooseSort(this.sortByYear)}>Year</button>
          <button onClick={() => this.withErrors()}>With Errors Only</button>
          <SearchBar onSearch={(search: string) => this.onSearch(search)} />
        </div>
        <WrappedGrid
          cellRenderer={this.cellRenderer.bind(this)}
          numItems={items.length}
        />
      </div>
    );
  }

  private goToAlbum(album: Album): void {
    this.props.goToAlbum(album);
  }

  private playAlbum(album: Album): void {
    const playlist = new RandomAlbumPlaylist(
      this.props.library, this.state.sortedAlbums);
    playlist.addAlbum(album);
    this.props.setPlaylistAndPlay(playlist);
  }

  private cellRenderer(index: number, key: string, style: React.CSSProperties): JSX.Element {
    const albums = this.state.withErrors
      ? this.state.sortedAlbums.filter((album: Album) => {
        return album.errors.length > 0;
      }) : this.state.sortedAlbums;
    return (
      <AlbumInfo
        album={albums[index]}
        goToAlbum={(album) => this.goToAlbum(album)}
        key={key}
        library={this.props.library}
        playAlbum={this.playAlbum.bind(this)}
        style={style}
      />
    );
  }

  private sortByName(album1: Album, album2: Album): number {
    return album1.name.localeCompare(album2.name);
  }

  private sortByArtist(album1: Album, album2: Album): number {
    const artist1 = this.props.library.getArtistsByIds(album1.artistIds)
      .map((artist: Artist) => artist.name).join(",");
    const artist2 = this.props.library.getArtistsByIds(album2.artistIds)
      .map((artist: Artist) => artist.name).join(",");
    return artist1.localeCompare(artist2);
  }

  private sortByYear(album1: Album, album2: Album): number {
    return album1.year - album2.year;
  }

  private chooseSort(sortMethod: (album1: Album, album2: Album) => number): void {
    if (sortMethod === this.state.sortMethod) {
      this.setState({reverse: !this.state.reverse});
    } else {
      this.setState({ sortMethod });
    }
  }

  private withErrors(): void {
    this.setState({
      withErrors: !this.state.withErrors,
    });
  }

  private onSearch(search: string): void {
    this.setState({ search });
  }
}
