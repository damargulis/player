import {changeVolume} from "./redux/actions";
import EmptyPlaylist from "./playlist/EmptyPlaylist";
import LikeButton from "./LikeButton";
import nextAlbum from "./resources/next_album.png";
import nextTrack from "./resources/next_track.png";
import pauseButton from "./resources/pause.png";
import playButton from "./resources/play.png";
import prevAlbum from "./resources/previous_album.png";
import prevTrack from "./resources/previous_track.png";
import React, {ChangeEvent} from "react";
import Modal from "react-modal";
import { connect } from "react-redux";
import {getVolume} from "./redux/selectors";
import {RootState} from "./redux/store";
import volumeButton from "./resources/volume.png";

// see: http://reactcommunity.org/react-modal/accessibility/#app-element
Modal.setAppElement("#root");

interface DispatchProps {
  changeVolume(volume: number): void;
}

interface OwnProps {
  playlist: EmptyPlaylist;
  volumeButton?: boolean;
  playing: boolean;
  prevAlbum(): void;
  prevTrack(): void;
  playPause(): void;
  nextTrack(): void;
  nextAlbum(): void;
}

interface StateProps {
  volume: number;
}

type ControlPanelProps = OwnProps & StateProps & DispatchProps;

interface ControlPanelState {
  volume: boolean;
}

class ControlPanel extends React.Component<ControlPanelProps, ControlPanelState> {
  constructor(props: ControlPanelProps) {
    super(props);

    this.state = {
      volume: false,
    };
  }

  public render(): JSX.Element {
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
          src={prevAlbum}
          style={{width: "25px"}}
          type="image"
        />
        <input
          alt="previous track"
          className="control-button"
          disabled={!this.props.playlist.hasPrevTrack()}
          onClick={this.props.prevTrack}
          src={prevTrack}
          style={{width: "25px"}}
          type="image"
        />
        <input
          alt="play-pause"
          className="control-button"
          disabled={!this.props.playlist.getCurrentTrack()}
          onClick={this.props.playPause}
          src={this.props.playing ? pauseButton : playButton}
          style={{width: "25px"}}
          type="image"
        />
        <input
          alt="next track"
          className="control-button"
          disabled={!this.props.playlist.hasNextTrack()}
          onClick={this.props.nextTrack}
          src={nextTrack}
          style={{width: "25px"}}
          type="image"
        />
        <input
          alt="next album"
          className="control-button"
          disabled={!this.props.playlist.hasNextAlbum()}
          onClick={this.props.nextAlbum}
          src={nextAlbum}
          style={{width: "25px"}}
          type="image"
        />
        <LikeButton
          item={this.props.playlist.getCurrentTrack()}
        />
      </div>
    );
  }

  private setVolume(evt: ChangeEvent<HTMLInputElement>): void {
    this.props.changeVolume(parseFloat(evt.currentTarget.value));
  }

  private onClick(): void {
    this.setState({
      volume: true,
    });
  }

  private close(): void {
    this.setState({
      volume: false,
    });
  }

  private getVolumeControl(): JSX.Element {
    if (this.props.volumeButton) {
      const style = {
        content: {
          overflow: "hidden",
        },
      };
      return (
        <div>
          <input
            alt="volume"
            className="control-button"
            onClick={this.onClick.bind(this)}
            src={volumeButton}
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
                bottom: "0px",
                left: "5%",
                position: "absolute",
                top: "0px",
                width: "90%",
              }}
              type="range"
              value={this.props.volume}
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
          WebkitAppearance: "slider-vertical",
          height: "80%",
          width: "25px",
        }}
        type="range"
        value={this.props.volume}
      />
    );
  }
}

function mapStateToProps(store: RootState): StateProps {
  return {
    volume: getVolume(store),
  };
}

export default connect(mapStateToProps, {changeVolume})(ControlPanel);
