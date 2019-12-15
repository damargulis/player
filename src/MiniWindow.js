import ControlPanel from './ControlPanel';
import EmptyPlaylist from './playlist/EmptyPlaylist';
import InfoPanel from './InfoPanel';
import Library from './library/Library';
import ProgressBar from './ProgressBar';
import PropTypes from 'prop-types';
import React from 'react';

const {ipcRenderer} = require('electron');

export default class MiniWindow extends React.Component {
  goToSong(song) {
    ipcRenderer.send('goToSong', {song});
  }

  goToArtist(artist) {
    ipcRenderer.send('goToArtist', {artist});
  }

  goToAlbum(album) {
    ipcRenderer.send('goToAlbum', {album});
  }

  render() {
    return (
      <div id="mini-window">
        <InfoPanel
          goToAlbum={this.goToAlbum.bind(this)}
          goToArtist={this.goToArtist.bind(this)}
          goToSong={this.goToSong.bind(this)}
          library={this.props.library}
          small={true}
          track={this.props.playlist.getCurrentTrack()}
        />
        <div style={{height: "25px", display: "flex"}}>
          <ControlPanel
            library={this.props.library}
            nextAlbum={this.props.nextAlbum}
            nextTrack={this.props.nextTrack}
            playing={this.props.playing}
            playlist={this.props.playlist}
            playPause={this.props.playPause}
            prevAlbum={this.props.prevAlbum}
            prevTrack={this.props.prevTrack}
            setVolume={this.props.setVolume}
            volumeButton={true}
          />
        </div>
        <ProgressBar
          setTime={this.props.setTime}
          time={this.props.time}
          track={this.props.playlist.getCurrentTrack()}
        />
      </div>
    );
  }
}

MiniWindow.propTypes = {
  library: PropTypes.instanceOf(Library).isRequired,
  nextAlbum: PropTypes.func.isRequired,
  nextTrack: PropTypes.func.isRequired,
  playPause: PropTypes.func.isRequired,
  playing: PropTypes.bool.isRequired,
  playlist: PropTypes.instanceOf(EmptyPlaylist).isRequired,
  prevAlbum: PropTypes.func.isRequired,
  prevTrack: PropTypes.func.isRequired,
  setTime: PropTypes.func.isRequired,
  setVolume: PropTypes.func.isRequired,
  time: PropTypes.number.isRequired,
};
