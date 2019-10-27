import React from 'react';
import { AutoSizer, Grid } from 'react-virtualized';

import ArtistInfo from './ArtistInfo';

export default class ArtistPicker extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      sortedArtists: this.sortArtists(this.props.artists),
    }

    this.numCols = 0;

  }

  sortArtists(artists) {
    return artists.slice().sort((artist1, artist2) => {
      return artist1.name.localeCompare(artist1.name);
    });
  }

  componentDidUpdate() {
    const sortedArtists = this.sortArtists(this.props.artists);
    if (sortedArtists.length !== this.state.sortedArtists.length || sortedArtists.some((artist, index) => {
      return this.state.sortedArtists[index] !== artist;
    })) {
      this.setState({
        sortedArtists: sortedArtists,
      });
    }
  }

  cellRenderer({columnIndex, key, rowIndex, style}) {
    const index = rowIndex * this.numCols + columnIndex;
    const artists = this.state.sortedArtists;
    return (
      <ArtistInfo
        library={this.props.library}
        index={index}
        key={key}
        style={style}
        artist={artists[index]}
      />
    )
  }

  // reuse the grid from album view?
  // source pictures from wikipedia, rotate album covers as backup
  render() {
    return (
      <div className="main">
      {
        this.getGrid()
      }
      </div>
    )
  }

  getGrid() {
    if (!this.state.sortedArtists) {
      return null;
    }
    const numArtists = this.state.sortedArtists.length;
    return (
      <AutoSizer>
        {({height, width}) => {
          this.numCols = Math.floor(width / 150);
          const rows = Math.ceil(numArtists / this.numCols);
          if (this.numCols <= 0 || numArtists <= 0) {
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
    )
  }
}
