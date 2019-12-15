import ArtistInfo from './ArtistInfo';
import Library from './library/Library';
import PropTypes from 'prop-types';
import React from 'react';
import SearchBar from './SearchBar';
import WrappedGrid from './WrappedGrid';

export default class ArtistPicker extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      sortedArtists: [],
      withErrors: false,
      search: '',
    };

    this.numCols = 0;
  }

  sortArtists(artists) {
    return artists.filter((artist) => {
      if (this.state.search) {
        return artist.name.toLowerCase()
          .includes(this.state.search.toLowerCase());
      }
      return true;
    }).sort((artist1, artist2) => {
      return artist1.name.localeCompare(artist2.name);
    });
  }

  componentDidMount() {
    this.setState({
      sortedArtists: this.sortArtists(this.props.artists),
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
        artist={artists[index]}
        goToArtist={(artist) => this.goToArtist(artist)}
        index={index}
        key={key}
        library={this.props.library}
        style={style}
      />
    );
  }

  withErrors() {
    this.setState({
      withErrors: !this.state.withErrors,
    });
  }

  onSearch(search) {
    this.setState({search});
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
        <SearchBar onSearch={(search) => this.onSearch(search)} />
        <WrappedGrid
          cellRenderer={this.cellRenderer.bind(this)}
          items={items}
        />
      </div>
    );
  }
}

ArtistPicker.propTypes = {
  artists: PropTypes.array.isRequired,
  goToArtist: PropTypes.func.isRequired,
  library: PropTypes.instanceOf(Library).isRequired,
};
