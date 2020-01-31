import {Playlist, Track} from './redux/actionTypes';
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
  genres: string[];
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
    const allPlaylistTracks = this.props.tracks;
    const tracks = allPlaylistTracks.filter((track) => {
      if (this.props.genres.length) {
        return track.genreIds.some((genreId) => {
          return this.props.genres.includes(genreId);
        });
      }
      return true;
    });
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

function mapStateToProps(store: RootState, ownProps: OwnProps): StateProps {
  return {
    tracks: getTracksByIds(store, ownProps.playlist.trackIds),
  };
}

export default connect(mapStateToProps)(PlaylistPage);
