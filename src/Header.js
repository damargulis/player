import ControlPanel from './ControlPanel.js';
import InfoPanel from './InfoPanel.js';
import LikeButton from './LikeButton.js';
import ProgressBar from './ProgressBar.js';
import React from 'react';

export default class Header extends React.Component {
  render() {
    const track = this.props.playlist.getCurrentTrack();
    return (
      <div id="header" style={{padding: "2px"}}>
        <ControlPanel
          playing={this.props.playing}
          playPause={this.props.playPause}
          nextAlbum={this.props.nextAlbum}
          nextTrack={this.props.nextTrack}
          prevAlbum={this.props.prevAlbum}
          prevTrack={this.props.prevTrack}
          playlist={this.props.playlist}
          setVolume={this.props.setVolume}
        />
        <InfoPanel
          goToArtist={this.props.goToArtist}
          goToAlbum={this.props.goToAlbum}
          goToSong={this.props.goToSong}
          library={this.props.library}
          track={track}
        />
        <LikeButton
          track={track}
          library= {this.props.library}
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
