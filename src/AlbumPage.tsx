import {deleteAlbum, setPlaylist, updateAlbum, updateArtist, updateLibrary, updateTrack} from './redux/actions';
import {Album, AlbumInfo, Artist, ArtistInfo, Genre, LibraryInfo, Track, TrackInfo, TrackWarning} from './redux/actionTypes';
import AlbumEditor from './AlbumEditor';
import './AlbumPage.css';
import EmptyPlaylist from './playlist/EmptyPlaylist';
import LikeButton from './LikeButton';
import Links from './Links';
import runWikiExtension from './extensions/wiki/main';
import defaultAlbum from './resources/missing_album.png';
import NavigationBar from './NavigationBar';
import RandomAlbumPlaylist from './playlist/RandomAlbumPlaylist';
import * as React from 'react';
import Modal from 'react-modal';
import {connect} from 'react-redux';
import {
  getAlbumById, getArtistByName, getArtistsByIds, getGenreById, getTrackById, getTracksByIds, getWarningsFromAlbum
} from './redux/selectors';
import shortid from 'shortid';
import {RootState} from './redux/store';
import TrackPicker from './TrackPicker';
import {getImgSrc, toTime} from './utils';
import WikiLabel from './WikiLabel';

// see: http://reactcommunity.org/react-modal/accessibility/#app-element
Modal.setAppElement('#root');

interface StateProps {
  artists: Artist[];
  tracks: Track[];
  album: Album;
  warnings: TrackWarning[];
  getGenreById(id: string): Genre;
  getTracksByIds(ids: string[]): Track[];
  getTrackById(id: string): Track;
  runWikiExtension(albumIds: string[]): PromiseLike<LibraryInfo>;
  getArtistByName(name: string): Artist | undefined;
}

interface OwnProps {
  albumId: string;
  canGoForward: boolean;
  goToArtist(artistId: string): void;
  goBack(): void;
  goForward(): void;
  goToAlbumPicker(): void;
}

interface DispatchProps {
  setPlaylist(playlist: EmptyPlaylist, play: boolean): void;
  updateLibrary(update: LibraryInfo): void;
  updateTrack(id: string, info: TrackInfo): void;
  updateAlbum(id: string, info: AlbumInfo): void;
  deleteAlbum(id: string): void;
  updateArtist(id: string, info: object): void;
}

interface AlbumPageState {
  editing: boolean;
  deleting: boolean;
}

type AlbumPageProps = OwnProps & StateProps & DispatchProps;

class AlbumPage extends React.Component<AlbumPageProps, AlbumPageState> {
  constructor(props: AlbumPageProps) {
    super(props);

    this.state = {
      editing: false,
      deleting: false,
    };
  }

  public render(): JSX.Element {
    const file = this.props.album.albumArtFile;
    const src = file ? getImgSrc(file).toString() : defaultAlbum;
    // TODO: set playTrack to play an album playlist of by artist ?
    return (
      <div className="main">
        <Modal isOpen={this.state.editing} onRequestClose={() => this.closeEdit()}>
          <AlbumEditor exit={() => this.closeEdit()} album={this.props.album} />
        </Modal>
        <Modal
          style={{content: {margin: '20%'}}}
          isOpen={this.state.deleting}
          onRequestClose={() => this.closeDelete()}
        >
          <div>Confirm Delete Album?</div>
          <button onClick={() => this.confirmDelete()}>Delete</button>
          <button onClick={() => this.closeDelete()}>Cancel</button>
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
            <div>{this.props.album.genreIds.map((genreId) => this.props.getGenreById(genreId).name).join(', ' )}</div>
            <WikiLabel wikiPage={this.props.album.wikiPage} />
            <button onClick={() => this.runWiki()}>
              Run Wiki Extension
            </button>
          </div>
          <div className="albumPageControls" >
            <button onClick={() => this.playAlbum()} className="playAlbum" >Play Album</button>
            <div className="likeButtonContainer">
              <LikeButton item={this.props.album} update={this.props.updateAlbum}/>
            </div>
            <button onClick={() => this.editAlbum()} className="editAlbum" >Edit Album</button>
            <button onClick={() => this.deleteAlbum()} className="deleteAlbum">Delete Album</button>
          </div>
          {this.getErrors()}
          {this.getWarnings()}
        </div>
        <div style={{height: '50%'}}>
          <TrackPicker tracks={this.props.getTracksByIds(this.props.album.trackIds)} sortBy="index" />
        </div>
      </div>
    );
  }

  private runWiki(): void {
    this.props.runWikiExtension([this.props.album.id]).then((updates) => {
      this.props.updateLibrary(updates);
    });
  }

  private acceptTrackWarnings(): void {
    const newArtistNamesToId = new Map();
    this.props.warnings.forEach((warning, index) => {
      if (Object.keys(warning).length === 0) {
        return;
      }
      const featuredArtists = (warning.featuring || []).map((artistName) => {
        const artist = this.props.getArtistByName(artistName);
        if (artist) {
          return artist.id;
        }
        if (newArtistNamesToId.has(artistName)) {
          return newArtistNamesToId.get(artistName);
        }
        const newId = shortid.generate();
        newArtistNamesToId.set(artistName, newId);
        this.props.updateArtist(newId, {
          id: newId,
          name: artistName,
          genreIds: [],
          albumIds: [],
          errors: [],
          trackIds: [this.props.album.trackIds[index]],
        });
        return newId;
      });
      this.props.updateTrack(this.props.album.trackIds[index], {
        ...warning,
        warning: undefined,
        artistIds: [...this.props.album.artistIds, ...featuredArtists],
      });
    });
  }

  private getWarnings(): JSX.Element | undefined {
    if (!this.props.warnings.find((warning) => Object.keys(warning).length > 0)) {
      return undefined;
    }
    return (
      <div className="warningsContainer">
        <table>
          <tbody>
            {
              this.props.warnings.map((warning, index) => {
                if (Object.keys(warning).length === 0) {
                  return;
                }
                return (
                  <tr key={index}>
                    <td>{index + 1}.</td>
                    {warning.name ? (<td>Title: {warning.name}</td>) : undefined}
                    {warning.featuring ? (<td>Featuring: {warning.featuring.join(', ')}</td>) : undefined}
                  </tr>
                );
              })
            }
          </tbody>
        </table>
        <button onClick={() => this.acceptTrackWarnings()}>Accept</button>
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
    const duration = this.props.tracks.reduce((total: number, track: Track) => total + track.duration, 0);
    return toTime(duration);
  }

  private playAlbum(): void {
    const playlist = new RandomAlbumPlaylist([this.props.album]);
    this.props.setPlaylist(playlist, /* play= */ true);
  }

  private deleteAlbum(): void {
    this.setState({deleting: true});
  }

  private confirmDelete(): void {
    this.props.deleteAlbum(this.props.albumId);
    this.props.goToAlbumPicker();
  }

  private closeDelete(): void {
    this.setState({deleting: false});
  }

  private editAlbum(): void {
    this.setState({editing: true});
  }

  private closeEdit(): void {
    this.setState({editing: false});
  }
}

function mapStateToProps(state: RootState, ownProps: OwnProps): StateProps {
  const album = getAlbumById(state, ownProps.albumId);
  return {
    getArtistByName: (name: string) => getArtistByName(state, name),
    artists: getArtistsByIds(state, album.artistIds),
    getTrackById: (id: string) => getTrackById(state, id),
    getTracksByIds: (ids: string[]) => getTracksByIds(state, ids),
    runWikiExtension: (albumIds: string[]) => runWikiExtension(albumIds, /* artistIds= */ [], state),
    tracks: getTracksByIds(state, album.trackIds),
    album: album,
    getGenreById: (id: string) => getGenreById(state, id),
    warnings: getWarningsFromAlbum(state, album),
  };
}

export default connect(mapStateToProps,
  {deleteAlbum, setPlaylist, updateAlbum, updateArtist, updateLibrary, updateTrack})(AlbumPage);
