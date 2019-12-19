import EmptyPlaylist from './playlist/EmptyPlaylist';
import Library from './library/Library';
import LikeButton from './LikeButton';
import Modal from 'react-modal';
import React, {ChangeEvent} from 'react';
import {Resources} from './constants';
import {getImgSrc} from './utils';

// see: http://reactcommunity.org/react-modal/accessibility/#app-element
Modal.setAppElement('#root');

interface ControlPanelProps {
  setVolume: (vol: number) => void;
  playlist: EmptyPlaylist;
  volumeButton?: boolean;
  prevAlbum: () => void;
  prevTrack: () => void;
  playPause: () => void;
  playing: boolean;
  nextTrack: () => void;
  library: Library;
  nextAlbum: () => void;
}

interface ControlPanelState {
  volume: boolean;
}

export default class ControlPanel extends React.Component<ControlPanelProps,ControlPanelState> {
  constructor(props: ControlPanelProps) {
    super(props);

    this.state = {
      volume: false,
    };
  }

  setVolume(evt: ChangeEvent<HTMLInputElement>) {
    this.props.setVolume(parseInt(evt.currentTarget.value));
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
        content: {
          overflow: "hidden",
        }
      };
      return (
        <div>
          <input
            alt="volume"
            className="control-button"
            onClick={this.onClick.bind(this)}
            src={getImgSrc(Resources.VOLUME)}
            style={{width: "25px"}}
            type="image"
          />
          <Modal
            isOpen={this.state.volume}
            onRequestClose={this.close.bind(this)}
            style={style}
          >
            <input
              max={1}
              min={0}
              onChange={this.setVolume.bind(this)}
              step={.01}
              style={{
                position: "absolute",
                top: "0px",
                left: "5%",
                bottom: "0px",
                width: "90%",
              }}
              type="range"
            />
          </Modal>
        </div>
      );
    }
    return (
      <input
        max={1}
        min={0}
        onChange={this.setVolume.bind(this)}
        step={.01}
        style={{
          "WebkitAppearance": "slider-vertical",
          width: "25px",
          height: "80%"
        }}
        type="range"
      />
    );
  }

  render() {
    return (
      <div id="control-panel" style={{display: "flex"}}>
        {
          this.getVolumeControl()
        }
        <input
          alt="previous album"
          className="control-button"
          disabled={!this.props.playlist.hasPrevAlbum()}
          onClick={this.props.prevAlbum}
          src={getImgSrc(Resources.PREVIOUS_ALBUM)}
          style={{width: "25px"}}
          type="image"
        />
        <input
          alt="previous track"
          className="control-button"
          disabled={!this.props.playlist.hasPrevTrack()}
          onClick={this.props.prevTrack}
          src={getImgSrc(Resources.PREVIOUS_TRACK)}
          style={{width: "25px"}}
          type="image"
        />
        <input
          alt="play-pause"
          className="control-button"
          disabled={!this.props.playlist.getCurrentTrack()}
          onClick={this.props.playPause}
          src={getImgSrc(this.props.playing ? Resources.PAUSE : Resources.PLAY)}
          style={{width: "25px"}}
          type="image"
        />
        <input
          alt="next track"
          className="control-button"
          disabled={!this.props.playlist.hasNextTrack()}
          onClick={this.props.nextTrack}
          src={getImgSrc(Resources.NEXT_TRACK)}
          style={{width: "25px"}}
          type="image"
        />
        <input
          alt="next album"
          className="control-button"
          disabled={!this.props.playlist.hasNextAlbum()}
          onClick={this.props.nextAlbum}
          src={getImgSrc(Resources.NEXT_ALBUM)}
          style={{width: "25px"}}
          type="image"
        />
        <LikeButton
          item={this.props.playlist.getCurrentTrack()}
          library={this.props.library}
        />
      </div>
    );
  }
}
