import Artist from './library/Artist';
import Album from './library/Album';
import AlbumInfo from './AlbumInfo';
import Library from './library/Library';
import RandomAlbumPlaylist from './playlist/RandomAlbumPlaylist';
import * as React from 'react';
import SearchBar from './SearchBar';
import WrappedGrid from './WrappedGrid';

import './App.css';

interface AlbumPickerProps {
  albums: Album[];
  goToAlbum: (album: Album) => void;
  library: Library;
  setPlaylistAndPlay: (playlist: RandomAlbumPlaylist) => void;
}

export default class AlbumPicker extends React.Component<AlbumPickerProps,any> {
  numCols: number;

  constructor(props: AlbumPickerProps) {
    super(props);

    this.sortByName = this.sortByName.bind(this);
    this.sortByYear = this.sortByYear.bind(this);
    this.sortByArtist = this.sortByArtist.bind(this);

    this.state = {
      sortMethod: this.sortByName,
      reverse: false,
      sortedAlbums: [],
      withErrors: false,
      search: null,
    };
    this.numCols = 0;
  }

  sortAlbums(albums: Album[]) {
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

  componentDidMount() {
    this.setState({
      sortedAlbums: this.sortAlbums(this.props.albums),
    });
  }

  componentDidUpdate() {
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

  goToAlbum(album: Album) {
    this.props.goToAlbum(album);
  }

  playAlbum(album: Album) {
    const playlist = new RandomAlbumPlaylist(
      this.props.library, this.state.sortedAlbums);
    playlist.addAlbum(album);
    this.props.setPlaylistAndPlay(playlist);
  }

  cellRenderer(index: number, key: string, style: any) {
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

  sortByName(album1: Album, album2: Album) {
    return album1.name.localeCompare(album2.name);
  }

  sortByArtist(album1: Album, album2: Album) {
    const artist1 = this.props.library.getArtistsByIds(album1.artistIds)
      .map((artist: Artist) => artist.name).join(",");
    const artist2 = this.props.library.getArtistsByIds(album2.artistIds)
      .map((artist: Artist) => artist.name).join(",");
    return artist1.localeCompare(artist2);
  }

  sortByYear(album1: Album, album2: Album) {
    return album1.year - album2.year;
  }

  chooseSort(sortMethod: (album1: Album, album2: Album) => number) {
    if (sortMethod === this.state.sortMethod) {
      this.setState({reverse: !this.state.reverse});
    } else {
      this.setState({ sortMethod });
    }
  }

  withErrors() {
    this.setState({
      withErrors: !this.state.withErrors,
    });
  }

  onSearch(search: string) {
    this.setState({ search });
  }

  render() {
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
}

