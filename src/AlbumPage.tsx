import {setPlaylist, updateAlbum, updateTrack} from './redux/actions';
import {AlbumInfo, AlbumParams, Artist, Track, TrackInfo} from './redux/actionTypes';
import AlbumEditer from './AlbumEditer';
import './AlbumPage.css';
import runAlbumModifier from './extensions/wiki/albums';
import EmptyPlaylist from './playlist/EmptyPlaylist';
import LikeButton from './LikeButton';
import Links from './Links';
import defaultAlbum from './resources/missing_album.png';
import NavigationBar from './NavigationBar';
import RandomAlbumPlaylist from './playlist/RandomAlbumPlaylist';
import * as React from 'react';
import Modal from 'react-modal';
import {connect} from 'react-redux';
import {getArtistsByIds, getTrackById, getTracksByIds} from './redux/selectors';
import SongPicker from './SongPicker';
import {RootState} from './redux/store';
import {getImgSrc, toTime} from './utils';
import WikiLabel from './WikiLabel';

// see: http://reactcommunity.org/react-modal/accessibility/#app-element
Modal.setAppElement('#root');

interface StateProps {
  artists: Artist[];
  tracks: Track[];
  getTracksByIds(ids: number[]): Track[];
  getTrackById(id: number): Track;
  runAlbumModifier(album: AlbumInfo): Promise<AlbumInfo>;
}

interface OwnProps {
  album: AlbumParams;
  canGoForward: boolean;
  goToArtist(artist: Artist): void;
  goBack(): void;
  goForward(): void;
}

interface DispatchProps {
  setPlaylist(playlist: EmptyPlaylist, play: boolean): void;
  updateAlbum(id: number, info: AlbumInfo): void;
  updateTrack(id: number, info: TrackInfo): void;
}

interface AlbumPageState {
  editing: boolean;
}

type AlbumPageProps = OwnProps & StateProps & DispatchProps;

class AlbumPage extends React.Component<AlbumPageProps, AlbumPageState> {
  constructor(props: AlbumPageProps) {
    super(props);

    this.state = {editing: false};
  }

  public render(): JSX.Element {
    // TODO: use albumInfo or combine logic
    // ya know actually separate conscers and shit
    const file = this.props.album.albumArtFile;
    const src = file ? getImgSrc(file).toString() : defaultAlbum;
    // TODO: set playSong to play an album playlist of by artist ?
    return (
      <div className="main">
        <Modal isOpen={this.state.editing} onRequestClose={this.closeEdit.bind(this)}>
          <AlbumEditer exit={this.closeEdit.bind(this)} album={this.props.album} />
        </Modal>
        <div className="albumPageHeader" >
          <div className="info">
            <NavigationBar
              canGoForward={this.props.canGoForward}
              goBack={this.props.goBack}
              goForward={this.props.goForward}
            />
            <img alt="album art" height="100" src={src} width="100" />
            <div>{this.props.album.name}</div>
            <Links items={this.props.artists} goToItem={this.props.goToArtist} name="Artists" />
            <div>Total Time: {this.getTotalTime()}</div>
            <div>{this.props.album.year}</div>
            <WikiLabel wikiPage={this.props.album.wikiPage} />
            <button onClick={this.runWiki.bind(this)}>
              Run Wiki Extension
            </button>
          </div>
          <div className="albumPageControls" >
            <button onClick={this.playAlbum.bind(this)} className="playAlbum" >Play Album</button>
            <div className="likeButtonContainer">
              <LikeButton item={this.props.album} update={this.props.updateAlbum}/>
            </div>
            <button onClick={this.editAlbum.bind(this)} className="editAlbum" >Edit Album</button>
          </div>
          {this.getErrors()}
          {this.getWarnings()}
        </div>
        <SongPicker songs={this.props.getTracksByIds(this.props.album.trackIds)} sortBy="index" />
      </div>
    );
  }

  private runWiki(): void {
    this.props.runAlbumModifier(this.props.album).then((info: AlbumInfo) => {
      this.props.updateAlbum(this.props.album.id, info);
    });
  }

  private acceptTrackWarnings(): void {
    const warnings = {...this.props.album.warnings};
    for (const indexStr in warnings) {
      if (warnings.hasOwnProperty(indexStr)) {
        const index = parseInt(indexStr, 10);
        const track = this.props.getTrackById(this.props.album.trackIds[index]);
        const name = warnings[indexStr];
        this.props.updateTrack(track.id, {name});
      }
    }
    this.props.updateAlbum(this.props.album.id, {warnings: {}});
  }

  private getWarnings(): JSX.Element | undefined {
    const warnings = Object.keys(this.props.album.warnings);
    if (!warnings.length) {
      return;
    }
    return (
      <div className="warningsContainer" >
        <div> Warnings: </div>
        {
          warnings.map((trackIndex) => {
            return (
              <div key={trackIndex}>{`${parseInt(trackIndex, 10) + 1}: ${this.props.album.warnings[trackIndex]}`}
              </div>
            );
          })
        }
        <button onClick={this.acceptTrackWarnings.bind(this)}>Accept</button>
      </div>
    );
  }

  private getErrors(): JSX.Element | undefined {
    if (!this.props.album.errors.length) {
      return;
    }
    return (
      <div className="errorsContainer" >
        <div> Errors: </div>
        {
          this.props.album.errors.map((error: string) => {
            return (
              <div key={error}>{error}</div>
            );
          })
        }
      </div>
    );
  }

  private getTotalTime(): string {
    const duration = this.props.tracks.reduce((total: number, song: Track) => total + song.duration, 0);
    return toTime(duration);
  }

  private playAlbum(): void {
    const playlist = new RandomAlbumPlaylist([this.props.album]);
    this.props.setPlaylist(playlist, /* play= */ true);
  }

  private editAlbum(): void {
    this.setState({editing: true});
  }

  private closeEdit(): void {
    this.setState({editing: false});
  }
}

function mapStateToProps(state: RootState, ownProps: OwnProps): StateProps {
  return {
    artists: getArtistsByIds(state, ownProps.album.artistIds),
    getTrackById: (id: number) => getTrackById(state, id),
    getTracksByIds: (ids: number[]) => getTracksByIds(state, ids),
    runAlbumModifier: (album: AlbumParams) => runAlbumModifier(state, album),
    tracks: getTracksByIds(state, ownProps.album.trackIds),
  };
}

export default connect(mapStateToProps, {setPlaylist, updateAlbum, updateTrack})(AlbumPage);
