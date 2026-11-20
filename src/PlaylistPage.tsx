import {Playlist, Track} from './redux/actionTypes';
import {libraryMemo} from './redux/memo';
import NavigationBar from './NavigationBar';
import React from 'react';
import {connect} from 'react-redux';
import {getTracksByIds} from './redux/selectors';
import {RootState} from './redux/store';
import TrackPicker from './TrackPicker';
import {toTime} from './utils';

interface OwnProps {
  playlist: Playlist;
  canGoForward: boolean;
  goBack(): void;
  goForward(): void;
}

interface StateProps {
  tracks: Track[];
}

type PlaylistPageProps = StateProps & OwnProps;

class PlaylistPage extends React.Component<PlaylistPageProps> {

  public render(): JSX.Element {
    const src = '';
    // No genre filter here: MaxWindow only ever passed an empty list, and TrackPicker narrows
    // by the picked genres itself, reading them from `settings`.
    const tracks = this.props.tracks;
    return (
      <div className="main">
        <div className="playlistPageHeader" style={{display: 'flex'}}>
          <div className="info">
            <NavigationBar
              canGoForward={this.props.canGoForward}
              goBack={this.props.goBack}
              goForward={this.props.goForward}
            />
            <img alt="playlist" height="100" src={src} width="100" />
            <div>{this.props.playlist && this.props.playlist.name}</div>
            <div>Total Time: {this.getTotalTime()}</div>
          </div>
        </div>
        <div className="playlistPageBody" style={{height: '100%'}}>
          <TrackPicker tracks={tracks} />
        </div>
      </div>
    );
  }

  private getTotalTime(): string {
    const duration = this.props.tracks.reduce((total, track) => total + track.duration, 0);
    return toTime(duration);
  }
}

/** Per instance and keyed on the library: a fresh array per action re-sorted the list four times a second. */
function makeMapStateToProps(): (store: RootState, ownProps: OwnProps) => StateProps {
  const tracksOf = libraryMemo(getTracksByIds);
  return (store: RootState, ownProps: OwnProps): StateProps => ({
    tracks: tracksOf(store, ownProps.playlist.trackIds),
  });
}

export default connect(makeMapStateToProps)(PlaylistPage);
