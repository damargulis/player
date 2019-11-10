import React from 'react';
import SongPicker  from './SongPicker.js';

export default class PlaylistPage extends React.Component {
  render() {
    const src = "";
    const allPlaylistSongs = this.props.library.getArtistTracks(
      this.props.playlist);
    const songs = allPlaylistSongs.filter((song) => {
      if (this.props.genres.length) {
        return song.genreIds.some((genreId) => {
          return this.props.genres.includes(genreId);
        });
      }
      return true;
    });
    return (
      <div className="main">
        <div className="playlistPageHeader" style={{display: "flex"}}>
          <div className="info">
            <img src={src} alt="playlist" width="100" height="100" />
            <div>{this.props.playlist && this.props.playlist.name}</div>
            <button onClick={this.props.goBack}>Back</button>
            <button
              disabled={!this.props.canGoForward}
              onClick={this.props.goForward}
            >
              Forward
            </button>
          </div>
        </div>
        <div className="playlistPageBody" style={{height: "100%"}}>
          <SongPicker
            setPlaylistAndPlay={this.props.setPlaylistAndPlay}
            playSong={this.props.playSong}
            library={this.props.library}
            songs={songs}
          />
        </div>
      </div>
    );
  }
}
