import React from 'react';

import './App.css';
import AlbumInfo from './AlbumInfo';
import WrappedGrid from './WrappedGrid';
import AlbumPage from './AlbumPage';

export default class AlbumPicker extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedAlbum: null,
      sortMethod: null,
      reverse: false,
      sortedAlbums: this.sortAlbums(this.props.albums),
    }
    this.numCols = 0;

    this.sortByName = this.sortByName.bind(this);
    this.sortByYear = this.sortByYear.bind(this);
    this.sortByArtist = this.sortByArtist.bind(this);
  }

  sortAlbums(albums) {
    if (this.state && this.state.sortMethod) {
      return albums.slice().sort((album1, album2) => {
        if (this.state.reverse) {
          return this.state.sortMethod(album2, album1);
        }
        return this.state.sortMethod(album1, album2);
      });
    }
    return albums.slice().sort((album1, album2) => {
      return album1.name.localeCompare(album2.name);
    });
  }
  
  componentDidUpdate() {
    const sortedAlbums = this.sortAlbums(this.props.albums);
    if (sortedAlbums.length !== this.state.sortedAlbums.length || sortedAlbums.some((album, index) => {
      return this.state.sortedAlbums[index] !== album;
    })) {
      this.setState({
        sortedAlbums: sortedAlbums,
      });
    }
  }

  goToAlbum(album) {
    
    this.setState({
      selectedAlbum: album
    });
  }

  cellRenderer(index, key, style) {
    const albums = this.state.sortedAlbums;
    return (
      <AlbumInfo
        playAlbum={this.props.playAlbum}
        goToAlbum={(album) => this.goToAlbum(album)}
        library={this.props.library}
        index={index}
        key={key}
        style={style}
        album={albums[index]}
      />
    )
  }

  sortByName(album1, album2) {
    return album1.name.localeCompare(album2.name)
  }

  sortByArtist(album1, album2) {
    const artist1 = this.props.library.getArtistsByIds(album1.artistIds).map(artist => artist.name).join(",");
    const artist2 = this.props.library.getArtistsByIds(album2.artistIds).map(artist => artist.name).join(",");
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

  goBack() {
    this.setState({
      selectedAlbum: null,
    });
  }

  render() {
    if (this.state.selectedAlbum) {
      return (
        <AlbumPage
          library={this.props.library}
          album={this.state.selectedAlbum}
          goBack={this.goBack.bind(this)}
        />
      )
    }
    return (
      <div className="main" >
      <div id="sortPicker" style={{textAlign: "center"}}>
        <button onClick={() => this.chooseSort(this.sortByName)}>Name</button>
        <button onClick={() => this.chooseSort(this.sortByArtist)}>Artist</button>
        <button onClick={() => this.chooseSort(this.sortByYear)}>Year</button>
      </div>
      <WrappedGrid
        items={this.state.sortedAlbums}
        cellRenderer={this.cellRenderer.bind(this)}
      />
      </div>
    )
  }
}

