import './PlaylistTypePicker.css';
import React from 'react';

interface PlaylistTypePickerProps {
  setType(playlistType: string): void;
}

export default class PlaylistTypePicker extends React.Component<PlaylistTypePickerProps> {

  public render(): JSX.Element {
    return (
      <div id="playlist-picker">
        <select size={4} className="playlist-type-container">
          <option onClick={() => this.props.setType('album')} className="playlist-type-option" >Albums</option>
          <option onClick={() => this.props.setType('artist')} className="playlist-type-option" >Artists</option>
          <option onClick={() => this.props.setType('song')} className="playlist-type-option" >Songs</option>
          <option onClick={() => this.props.setType('playlist')} className="playlist-type-option" >Playlists</option>
        </select>
      </div>
    );
  }
}
