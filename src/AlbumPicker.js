import AlbumInfo from './AlbumInfo';
import RandomAlbumPlaylist from './playlist/RandomAlbumPlaylist';
import React from 'react';
import SearchBar from './SearchBar';
import WrappedGrid from './WrappedGrid';

import './App.css';

export default class AlbumPicker extends React.Component {
  constructor(props) {
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

  sortAlbums(albums) {
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

  goToAlbum(album) {
    this.props.goToAlbum(album);
  }

  playAlbum(album) {
    const playlist = new RandomAlbumPlaylist(
      this.props.library, this.state.sortedAlbums);
    playlist.addAlbum(album);
    this.props.setPlaylistAndPlay(playlist);
  }

  cellRenderer(index, key, style) {
    const albums = this.state.withErrors
      ? this.state.sortedAlbums.filter((album) => {
        return album.errors.length > 0;
      }) : this.state.sortedAlbums;
    return (
      <AlbumInfo
        playAlbum={this.playAlbum.bind(this)}
        goToAlbum={(album) => this.goToAlbum(album)}
        library={this.props.library}
        index={index}
        key={key}
        style={style}
        album={albums[index]}
      />
    );
  }

  sortByName(album1, album2) {
    return album1.name.localeCompare(album2.name);
  }

  sortByArtist(album1, album2) {
    const artist1 = this.props.library.getArtistsByIds(album1.artistIds)
      .map(artist => artist.name).join(",");
    const artist2 = this.props.library.getArtistsByIds(album2.artistIds)
      .map(artist => artist.name).join(",");
    return artist1.localeCompare(artist2);
  }

  sortByYear(album1, album2) {
    return album1.year - album2.year;
  }

  chooseSort(sortMethod) {
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

  onSearch(search) {
    this.setState({ search });
  }

  render() {
    const items = this.state.withErrors
      ? this.state.sortedAlbums.filter((album) => {
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
          <SearchBar onSearch={(search) => this.onSearch(search)} />
        </div>
        <WrappedGrid
          items={items}
          cellRenderer={this.cellRenderer.bind(this)}
        />
      </div>
    );
  }
}

