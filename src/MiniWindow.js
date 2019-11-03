import ControlPanel from './ControlPanel.js';
import InfoPanel from './InfoPanel.js';
import React from 'react';

export default class MiniWindow extends React.Component {

  render() {
    return (
      <div id="mini-window">
        <InfoPanel
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
      </div>
    )
  }
}
