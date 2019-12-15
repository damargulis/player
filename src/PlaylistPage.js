import Library from './library/Library';
import NavigationBar from './NavigationBar';
import PropTypes from 'prop-types';
import RandomSongPlaylist from './playlist/RandomSongPlaylist';
import React from 'react';
import SongPicker from './SongPicker.js';
import {toTime} from './utils';

export default class PlaylistPage extends React.Component {
  getTotalTime() {
    const songs = this.props.library.getArtistTracks(
      this.props.playlist);
    const duration = songs.reduce((total, song) => total + song.duration, 0);
    return toTime(duration);
  }

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
            <NavigationBar
              canGoForward={this.props.canGoForward}
              goBack={this.props.goBack}
              goForward={this.props.goForward}
            />
            <img alt="playlist" height="100" src={src} width="100" />
            <div>{this.props.playlist && this.props.playlist.name}</div>
            <div>Total Time: {this.getTotalTime()}</div>
          </div>
        </div>
        <div className="playlistPageBody" style={{height: "100%"}}>
          <SongPicker
            library={this.props.library}
            playSong={this.props.playSong}
            setPlaylistAndPlay={this.props.setPlaylistAndPlay}
            songs={songs}
          />
        </div>
      </div>
    );
  }
}

PlaylistPage.propTypes = {
  canGoForward: PropTypes.bool.isRequired,
  genres: PropTypes.array.isRequired,
  goBack: PropTypes.func.isRequired,
  goForward: PropTypes.func.isRequired,
  library: PropTypes.instanceOf(Library).isRequired,
  playSong: PropTypes.func.isRequired,
  playlist: PropTypes.instanceOf(RandomSongPlaylist).isRequired,
  setPlaylistAndPlay: PropTypes.func.isRequired,
};
