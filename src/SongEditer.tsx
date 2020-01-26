import {TrackParams} from './redux/actionTypes';
import MultipleSongEditer from './MultipleSongEditer';
import React from 'react';
import SingleSongEditer from './SingleSongEditer';
import './SongEditer.css';

interface SongEditerProps {
  tracks: TrackParams[];
  exit(): void;
}

export default class SongEditer extends React.Component<SongEditerProps> {
  public render(): JSX.Element | undefined {
    if (this.props.tracks.length === 0) {
      // TODO: Error out
      return;
    }
    if (this.props.tracks.length === 1) {
      return <SingleSongEditer exit={this.props.exit} track={this.props.tracks[0]} />;
    }
    return <MultipleSongEditer exit={this.props.exit} tracks={this.props.tracks} />;
  }
}
