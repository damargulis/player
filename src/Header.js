import ControlPanel from './ControlPanel.js';
import EmptyPlaylist from './playlist/EmptyPlaylist';
import InfoPanel from './InfoPanel.js';
import Library from './library/Library';
import ProgressBar from './ProgressBar.js';
import PropTypes from 'prop-types';
import React from 'react';

export default class Header extends React.Component {
  render() {
    const track = this.props.playlist.getCurrentTrack();
    return (
      <div id="header" style={{padding: "2px"}}>
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
        />
        <InfoPanel
          goToAlbum={this.props.goToAlbum}
          goToArtist={this.props.goToArtist}
          goToSong={this.props.goToSong}
          library={this.props.library}
          track={track}
        />
        <ProgressBar
          setTime={this.props.setTime}
          time={this.props.time}
          track={track}
        />
      </div>
    );
  }
}

Header.propTypes = {
  goToAlbum: PropTypes.func.isRequired,
  goToArtist: PropTypes.func.isRequired,
  goToSong: PropTypes.func.isRequired,
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
