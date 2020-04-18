import './PlaylistTypePicker.css';
import React from 'react';

interface PlaylistTypePickerProps {
  setType(playlistType: string): void;
}

// TODO: Change name to like PagePicker or something, playlist type is too confusing with other playlist stuff
export default class PlaylistTypePicker extends React.Component<PlaylistTypePickerProps> {

  public render(): JSX.Element {
    return (
      <div id="playlist-picker">
        <select size={4} className="playlist-type-container">
          <option onClick={() => this.props.setType('album')} className="playlist-type-option" >Albums</option>
          <option onClick={() => this.props.setType('artist')} className="playlist-type-option" >Artists</option>
          <option onClick={() => this.props.setType('track')} className="playlist-type-option" >Tracks</option>
          <option onClick={() => this.props.setType('playlist')} className="playlist-type-option" >Playlists</option>
          <option onClick={() => this.props.setType('new')} className="playlist-type-option">New Tracks</option>
        </select>
      </div>
    );
  }
}
