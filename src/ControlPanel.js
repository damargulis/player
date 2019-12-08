import React from 'react';
import Modal from 'react-modal';
import {Resources} from './constants';
import {getImgSrc} from './utils';

// see: http://reactcommunity.org/react-modal/accessibility/#app-element
Modal.setAppElement('#root');

export default class ControlPanel extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      volume: false,
    }
  }
  setVolume(evt) {
    this.props.setVolume(evt.target.value);
  }

  onClick() {
    this.setState({
      volume: true,
    });
  }

  close() {
    this.setState({
      volume: false,
    });
  }

  getVolumeControl() {
    if (this.props.volumeButton) {
      const style = {
        content:  {
          overflow: "hidden",
        }
      }
      return (
        <div>
        <input style={{width: "25px"}} type="image" alt="volume" src={getImgSrc(Resources.VOLUME)} onClick={this.onClick.bind(this)} className="control-button" />
        <Modal
          isOpen={this.state.volume}
          onRequestClose={this.close.bind(this)}
          style={style}
        >
          <input type="range" max={1} min={0} step={.01} orient="horizontal"
            onChange={this.setVolume.bind(this)}
            style={{
              position: "absolute",
              top: "0px",
              left: "5%",
              bottom: "0px",
              width: "90%",
            }}
          />
        </Modal>
        </div>
      )
    } else {
      return (
        <input type="range" max={1} min={0} step={.01} orient="vertical"
          onChange={this.setVolume.bind(this)}
          style={{"WebkitAppearance": "slider-vertical",
            width: "25px", height: "80%"}}
        />
      );
    }
  }

  render() {
    return (
      <div id="control-panel" style={{display: "flex"}}>
        {
          this.getVolumeControl()
        }
        <input
            style={{width: "25px"}}
            type="image"
            alt="volume"
            src={getImgSrc(Resources.PREVIOUS_ALBUM)}
            onClick={this.props.prevAlbum}
            disabled={!this.props.playlist.hasPrevAlbum()}
            className="control-button"
        />
        <input
            style={{width: "25px"}}
            type="image"
            alt="volume"
            src={getImgSrc(Resources.PREVIOUS_TRACK)}
            onClick={this.props.prevTrack}
            disabled={!this.props.playlist.hasPrevTrack()}
            className="control-button"
        />
        <input
            style={{width: "25px"}}
            type="image"
            alt="volume"
            src={getImgSrc(this.props.playing ? Resources.PAUSE : Resources.PLAY)}
            onClick={this.props.playPause}
            disabled={!this.props.playlist.getCurrentTrack()}
            className="control-button"
        />
        <input
            style={{width: "25px"}}
            type="image"
            alt="volume"
            src={getImgSrc(Resources.NEXT_TRACK)}
            onClick={this.props.nextTrack}
            disabled={!this.props.playlist.hasNextTrack()}
            className="control-button"
        />
        <input
            style={{width: "25px"}}
            type="image"
            alt="volume"
            src={getImgSrc(Resources.NEXT_ALBUM)}
            onClick={this.props.nextAlbum}
            disabled={!this.props.playlist.hasNextAlbum()}
            className="control-button"
        />
      </div>
    );
  }
}
