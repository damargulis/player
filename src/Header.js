import ControlPanel from './ControlPanel.js';
import InfoPanel from './InfoPanel.js';
import ProgressBar from './ProgressBar.js';
import React from 'react';

export default class Header extends React.Component {
  render() {
    return (
        <div id="header">
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
          <InfoPanel library={this.props.library} track={this.props.playlist.getCurrentTrack()}/>
          <ProgressBar setTime={this.props.setTime} time={this.props.time} track={this.props.playlist.getCurrentTrack()}/>
        </div>
    )
  }
}
