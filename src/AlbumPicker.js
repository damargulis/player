import React from 'react';

import './App.css';
import { AutoSizer, Grid } from 'react-virtualized';
import AlbumInfo from './AlbumInfo';

export default class AlbumPicker extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
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
      <div className="main" ref={element => this.divRef = element}>
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
      if (!this.state.sortedAlbums) {
        return null;
      }
      const numAlbums = this.state.sortedAlbums.length;
      return (
        <AutoSizer>
        {({height, width}) => {
          this.numCols = Math.floor(width / 150);
          const rows = Math.ceil(numAlbums / this.numCols)
          if (this.numCols <= 0 || numAlbums <= 0) {
            return null;
          }
          return (
          <Grid
            cellRenderer={this.cellRenderer.bind(this)}
            columnCount={this.numCols}
            columnWidth={width / this.numCols}
            height={height}
            rowCount={rows}
            rowHeight={150}
            width={width}
          />
        )}}
        </AutoSizer>
    );
  }

}


