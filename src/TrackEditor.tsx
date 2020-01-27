import {Track} from './redux/actionTypes';
import MultipleTrackEditor from './MultipleTrackEditor';
import React from 'react';
import SingleTrackEditor from './SingleTrackEditor';
import './TrackEditor.css';

interface TrackEditorProps {
  tracks: Track[];
  exit(): void;
}

export default class TrackEditor extends React.Component<TrackEditorProps> {
  public render(): JSX.Element | undefined {
    if (this.props.tracks.length === 0) {
      // TODO: Error out
      return;
    }
    if (this.props.tracks.length === 1) {
      return <SingleTrackEditor exit={this.props.exit} track={this.props.tracks[0]} />;
    }
    return <MultipleTrackEditor exit={this.props.exit} tracks={this.props.tracks} />;
  }
}
