import React from 'react';

export default class ControlPanel extends React.Component {
  setVolume(evt) {
    this.props.setVolume(evt.target.value);
  }

  render() {
    return (
        <div id="control-panel" style={{display: "flex"}}>
          <input type="range" max={1} min={0} step={.01} orient="vertical"
            onChange={this.setVolume.bind(this)}
            style={{"WebkitAppearance": "slider-vertical",
                width: "25px", height: "80%"}}/>
          <button onClick={this.props.prevAlbum}
            disabled={!this.props.playlist.hasPrevAlbum()}
            className="control-button">|&lt;</button>
          <button
            onClick={this.props.prevTrack}
            disabled={!this.props.playlist.hasPrevTrack()}
            className="control-button">&lt;</button>
          <button
            disabled={!this.props.playlist.getCurrentTrack()}
            onClick={this.props.playPause}
            className="control-button">
              {this.props.playing ? 'Pause' : 'Play'}
          </button>
          <button
            disabled={!this.props.playlist.hasNextTrack()}
            onClick={this.props.nextTrack}
            className="control-button">&gt;</button>
          <button
            disabled={!this.props.playlist.hasNextAlbum()}
            onClick={this.props.nextAlbum}
            className="control-button">&gt;|</button>
        </div>
    )
  }
}
