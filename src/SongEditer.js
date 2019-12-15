import Library from './library/Library';
import MultipleSongEditer from './MultipleSongEditer';
import PropTypes from 'prop-types';
import React from 'react';
import SingleSongEditer from './SingleSongEditer';
import Track from './library/Track';

import './SongEditer.css';

export default class SongEditer extends React.Component {
  render() {
    if (this.props.tracks.length === 0) {
      // TODO: Error out
      return null;
    }
    if (this.props.tracks.length === 1) {
      return (
        <SingleSongEditer
          exit={this.props.exit}
          library={this.props.library}
          track={this.props.tracks[0]}
        />
      );
    }
    return (
      <MultipleSongEditer
        exit={this.props.exit}
        library={this.props.library}
        tracks={this.props.tracks}
      />
    );
  }
}

SongEditer.propTypes = {
  exit: PropTypes.func.isRequired,
  library: PropTypes.instanceOf(Library).isRequired,
  tracks: PropTypes.arrayOf(PropTypes.instanceOf(Track)).isRequired,
};
