import ControlPanel from './ControlPanel.js';
import InfoPanel from './InfoPanel.js';
import React from 'react';
import ProgressBar from './ProgressBar.js';

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
          goToArtist={this.goToArtist.bind(this)}
          goToAlbum={this.goToAlbum.bind(this)}
          goToSong={this.goToSong.bind(this)}
          small={true}
          library={this.props.library}
          track={this.props.playlist.getCurrentTrack()}
        />
        <div style={{height: "25px", display: "flex"}}>
          <ControlPanel
            playing={this.props.playing}
            playPause={this.props.playPause}
            nextAlbum={this.props.nextAlbum}
            nextTrack={this.props.nextTrack}
            prevAlbum={this.props.prevAlbum}
            prevTrack={this.props.prevTrack}
            playlist={this.props.playlist}
            setVolume={this.props.setVolume}
            track={this.props.track}/>
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
