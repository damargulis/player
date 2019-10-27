import React from 'react';
import WrappedGrid from './WrappedGrid';

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
      return artist1.name.localeCompare(artist2.name);
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

  cellRenderer(index, key, style) {
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
        <WrappedGrid
          items={this.state.sortedArtists}
          cellRenderer={this.cellRenderer.bind(this)}
        />
      </div>
    )
  }
}
