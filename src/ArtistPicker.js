import ArtistInfo from './ArtistInfo';
import React from 'react';
import WrappedGrid from './WrappedGrid';


export default class ArtistPicker extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      sortedArtists: this.sortArtists(this.props.artists),
      withErrors: false,
    };

    this.numCols = 0;
  }

  sortArtists(artists) {
    return artists.slice().sort((artist1, artist2) => {
      return artist1.name.localeCompare(artist2.name);
    });
  }

  componentDidUpdate() {
    const sortedArtists = this.sortArtists(this.props.artists);
    if (sortedArtists.length !== this.state.sortedArtists.length ||
      sortedArtists.some((artist, index) => {
        return this.state.sortedArtists[index] !== artist;
      })) {
      this.setState({
        sortedArtists,
      });
    }
  }

  goToArtist(artist) {
    this.props.goToArtist(artist);
  }

  cellRenderer(index, key, style) {
    const artists = this.state.withErrors
      ? this.state.sortedArtists.filter((artist) => {
        return artist.errors.length > 0;
      }) : this.state.sortedArtists;
    return (
      <ArtistInfo
        goToArtist={(artist) => this.goToArtist(artist)}
        library={this.props.library}
        index={index}
        key={key}
        style={style}
        artist={artists[index]}
      />
    );
  }

  withErrors() {
    this.setState({
      withErrors: !this.state.withErrors,
    });
  }

  // reuse the grid from album view?
  // source pictures from wikipedia, rotate album covers as backup
  render() {
    const items = this.state.withErrors
      ? this.state.sortedArtists.filter((artist) => {
        return artist.errors.length > 0;
      }) : this.state.sortedArtists;
    return (
      <div className="main">
        <button onClick={() => this.withErrors()}>With Errors Only</button>
        <WrappedGrid
          items={items}
          cellRenderer={this.cellRenderer.bind(this)}
        />
      </div>
    );
  }
}
