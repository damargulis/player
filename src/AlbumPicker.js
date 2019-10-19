import React from 'react';

import './App.css';
import { Grid } from 'react-virtualized';
import AlbumInfo from './AlbumInfo';

export default class AlbumPicker extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      height: 0,
      width: 0,
      sortMethod: null,
      reverse: false,
      sortedAlbums: this.sortAlbums(this.props.albums),
    }
    this.numCols = 0;

    this.setSize_ = this.setSize_.bind(this);
    window.addEventListener('resize', this.setSize_);

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
    if (sortedAlbums.length === this.state.sortedAlbums.length && sortedAlbums.every((album, index) => {
      return this.state.sortedAlbums[index] === album;
    })) {
    } else {
      this.setState({
        sortedAlbums: sortedAlbums,
      });
    }
  }

  componentDidMount() {
    this.setSize_();
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.setSize_);
  }

  setSize_() {
    // force recalculation of the size by zeroing out grid
    // bad performance, should fix this
    this.setState({
      height: 0,
      width: 0,
    });
    setTimeout(() => {
      if (this.divRef) {
        this.setState({
          height: this.divRef.clientHeight,
          width: this.divRef.clientWidth
        });
      }
    }, 100);
  }

  cellRenderer({columnIndex, key, rowIndex, style}) {
    const index = rowIndex * this.numCols + columnIndex;
    const albums = this.state.sortedAlbums;
    return (
      <AlbumInfo
        playAlbum={this.props.playAlbum}
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

  render() {
    return (
      <div id="main" ref={element => this.divRef = element}>
      <div id="sortPicker" style={{textAlign: "center"}}>
        <button onClick={() => this.chooseSort(this.sortByName)}>Name</button>
        <button onClick={() => this.chooseSort(this.sortByArtist)}>Artist</button>
        <button onClick={() => this.chooseSort(this.sortByYear)}>Year</button>
      </div>
      {
        this.getGrid()
      }
      </div>
    )
  }

    getGrid() {
      if (!this.state.height || !this.state.width) {
        return null;
      }
      this.numCols = Math.floor(this.state.width / 150);
      if (!this.state.sortedAlbums) {
        return null;
      }
      const numAlbums = this.state.sortedAlbums.length;
      const rows = Math.ceil(numAlbums / this.numCols);
      return (
        <Grid
          cellRenderer={this.cellRenderer.bind(this)}
          columnCount={this.numCols}
          columnWidth={this.state.width / this.numCols}
          height={this.state.height}
          rowCount={rows}
          rowHeight={150}
          width={this.state.width}
        />
    );
  }

};


