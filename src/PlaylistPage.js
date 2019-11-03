import React from 'react';
import SongPicker  from './SongPicker.js';

export default class PlaylistPage extends React.Component {
  render() {
    const src = "";
    return (
      <div className="main">
        <div className="playlistPageHeader" style={{display: "flex"}}>
          <div className="info">
            <img src={src} alt="artist art" width="100" height="100" />
            <div>{this.props.playlist && this.props.playlist.name}</div>
            <button onClick={this.props.goBack}>Back</button>
          </div>
        </div>
        <div className="playlistPageBody" style={{height: "100%"}}>
          <SongPicker
            playSong={this.props.playSong}
            library={this.props.library}
            songs={this.props.library.getArtistTracks(this.props.playlist)}
          />
        </div>
      </div>
    );
  }
}
