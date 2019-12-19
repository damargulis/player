import Library from './library/Library';
import MultipleSongEditer from './MultipleSongEditer';
import React from 'react';
import SingleSongEditer from './SingleSongEditer';
import Track from './library/Track';

import './SongEditer.css';

interface SongEditerProps {
  tracks: Track[];
  exit: () => void;
  library: Library;
}

export default class SongEditer extends React.Component<SongEditerProps,{}> {
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
