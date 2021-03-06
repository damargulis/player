import {changeVolume, nextAlbum, nextTrack, playPause, prevAlbum, prevTrack, updateTrack} from './redux/actions';
import {Track, TrackInfo} from './redux/actionTypes';
import './ControlPanel.css';
import LikeButton from './LikeButton';
import nextAlbumImg from './resources/next_album.png';
import nextTrackImg from './resources/next_track.png';
import pauseButton from './resources/pause.png';
import playButton from './resources/play.png';
import prevAlbumImg from './resources/previous_album.png';
import prevTrackImg from './resources/previous_track.png';
import React, {ChangeEvent} from 'react';
import Modal from 'react-modal';
import {connect} from 'react-redux';
import {
  getCurrentTrack,
  getIsPlaying,
  getVolume,
  hasNextAlbum,
  hasNextTrack,
  hasPrevAlbum,
  hasPrevTrack,
} from './redux/selectors';
import {RootState} from './redux/store';
import volumeButton from './resources/volume.png';

// see: http://reactcommunity.org/react-modal/accessibility/#app-element
Modal.setAppElement('#root');

interface DispatchProps {
  changeVolume(volume: number): void;
  nextTrack(): void;
  nextAlbum(): void;
  prevAlbum(): void;
  prevTrack(): void;
  playPause(): void;
  updateTrack(id: string, track: TrackInfo): void;
}

interface OwnProps {
  volumeButton?: boolean;
}

interface StateProps {
  volume: number;
  hasPrevAlbum: boolean;
  hasPrevTrack: boolean;
  currentTrack?: Track;
  hasNextTrack: boolean;
  hasNextAlbum: boolean;
  playing: boolean;
}

type ControlPanelProps = OwnProps & StateProps & DispatchProps;

interface ControlPanelState {
  volume: boolean;
}

class ControlPanel extends React.Component<ControlPanelProps, ControlPanelState> {
  constructor(props: ControlPanelProps) {
    super(props);

    this.state = {volume: false};
  }

  public render(): JSX.Element {
    return (
      <div className="control-panel" >
        {this.getVolumeControl()}
        <input
          alt="previous album"
          className="control-button"
          disabled={!this.props.hasPrevAlbum}
          onClick={this.props.prevAlbum}
          src={prevAlbumImg}
          type="image"
        />
        <input
          alt="previous track"
          className="control-button"
          disabled={!this.props.hasPrevTrack}
          onClick={this.props.prevTrack}
          src={prevTrackImg}
          type="image"
        />
        <input
          alt="play-pause"
          className="control-button"
          disabled={!this.props.currentTrack}
          onClick={this.props.playPause}
          src={this.props.playing ? pauseButton : playButton}
          type="image"
        />
        <input
          alt="next track"
          className="control-button"
          disabled={!this.props.hasNextTrack}
          onClick={this.props.nextTrack}
          src={nextTrackImg}
          type="image"
        />
        <input
          alt="next album"
          className="control-button"
          disabled={!this.props.hasNextAlbum}
          onClick={this.props.nextAlbum}
          src={nextAlbumImg}
          type="image"
        />
        <LikeButton item={this.props.currentTrack} update={this.props.updateTrack} />
      </div>
    );
  }

  private setVolume(evt: ChangeEvent<HTMLInputElement>): void {
    this.props.changeVolume(parseFloat(evt.currentTarget.value));
  }

  private onClick(): void {
    this.setState({volume: true});
  }

  private close(): void {
    this.setState({volume: false});
  }

  private getVolumeControl(): JSX.Element {
    if (this.props.volumeButton) {
      const style = {
        content: {overflow: 'hidden'},
      };
      return (
        <div>
          <input
            alt="volume"
            className="control-button"
            onClick={() => this.onClick()}
            src={volumeButton}
            type="image"
          />
          <Modal
            isOpen={this.state.volume}
            onRequestClose={() => this.close()}
            style={style}
          >
            <input
              className="volume-input-modal"
              max={1}
              min={0}
              onChange={(evt) => this.setVolume(evt)}
              step={.01}
              type="range"
              value={this.props.volume}
            />
          </Modal>
        </div>
      );
    }
    return (
      <input
        className="volume-input"
        max={1}
        min={0}
        onChange={(evt) => this.setVolume(evt)}
        step={.01}
        type="range"
        value={this.props.volume}
      />
    );
  }
}

function mapStateToProps(store: RootState): StateProps {
  return {
    currentTrack: getCurrentTrack(store),
    hasNextAlbum: hasNextAlbum(store),
    hasNextTrack: hasNextTrack(store),
    hasPrevAlbum: hasPrevAlbum(store),
    hasPrevTrack: hasPrevTrack(store),
    playing: getIsPlaying(store),
    volume: getVolume(store),
  };
}

export default connect(mapStateToProps,
  {playPause, changeVolume, nextTrack, nextAlbum, prevAlbum, prevTrack, updateTrack})(ControlPanel);
