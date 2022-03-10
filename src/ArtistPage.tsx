import {deleteArtist, updateArtist, updateLibrary} from './redux/actions';
import {shell} from 'electron';
import {Album, Artist, ArtistInfo, Genre, LibraryInfo, Track} from './redux/actionTypes';
import AlbumPicker from './AlbumPicker';
import ArtistEditor from './ArtistEditor';
import './ArtistPage.css';
import runWikiExtension from './extensions/wiki/main';
import runSongkickExtension from './extensions/songkick/main';
import defaultArtist from './resources/missing_artist.png';
import NavigationBar from './NavigationBar';
import React from 'react';
import Modal from 'react-modal';
import {connect} from 'react-redux';
import {getAlbumsByIds, getArtistById, getGenreById, getTracksByIds} from './redux/selectors';
import {RootState} from './redux/store';
import TrackPicker from './TrackPicker';
import {getImgSrc} from './utils';
import WikiLabel from './WikiLabel';

interface StateProps {
  albums: Album[];
  tracks: Track[];
  artist: Artist;
  runWikiExtension(artistIds: string[]): PromiseLike<LibraryInfo>;
  runSongkickExtension(artistIds: string[]): PromiseLike<LibraryInfo>;
  getGenreById(genreId: string): Genre;
}

interface OwnProps {
  artistId: string;
  canGoForward: boolean;
  goBack(): void;
  goForward(): void;
  goToAlbum(albumId: string): void;
  goToArtistPicker(): void;
}

interface DispatchProps {
  deleteArtist(id: string): void;
  updateArtist(id: string, info: ArtistInfo): void;
  updateLibrary(updates: LibraryInfo): void;
}

type ArtistPageProps = OwnProps & StateProps & DispatchProps;

interface ArtistPageState {
  editing: boolean;
  deleting: boolean;
}

class ArtistPage extends React.Component<ArtistPageProps, ArtistPageState> {
  constructor(props: ArtistPageProps) {
    super(props);

    this.state = {
      editing: false,
      deleting: false,
    };
  }

  public render(): JSX.Element {
    const src = this.props.artist.artFile ? getImgSrc(this.props.artist.artFile) : defaultArtist;
    return (
      <div className="main">
        <Modal isOpen={this.state.editing} onRequestClose={() => this.closeEdit()}>
          <ArtistEditor exit={() => this.closeEdit()} artist={this.props.artist} />
        </Modal>
        <Modal
          style={{content: {margin: '20%'}}}
          isOpen={this.state.deleting}
          onRequestClose={() => this.closeDelete()}
        >
          <div>Confirm Delete Artist?</div>
          <button onClick={() => this.confirmDelete()}>Delete</button>
          <button onClick={() => this.closeDelete()}>Cancel</button>
        </Modal>
        <div className="artistPageHolder" >
          <div className="artistPageHeader" >
            <NavigationBar
              canGoForward={this.props.canGoForward}
              goBack={this.props.goBack}
              goForward={this.props.goForward}
            />
            <div className="info">
              <img alt="artist art" height="100" src={src} width="100" />
              <div>{this.props.artist.name}</div>
              <div>{this.props.artist.genreIds.map((genreId) => this.props.getGenreById(genreId).name).join(', ')}</div>
              <WikiLabel wikiPage={this.props.artist.wikiPage} />
              <button onClick={() => this.runWiki()}>Run Wiki Extension</button>
              <button onClick={() => this.runSongkick()}>Run Songkick Extension</button>
            </div>
            <button onClick={() => this.editArtist()} className="editArtist" >Edit Artist</button>
            <button onClick={() => this.deleteArtist()} className="deleteArtist">Delete Artist</button>
            {this.getErrors()}
            {this.getUpcomingEvents()}
          </div>
          <div className="artistPageBody" >
            <div className="artistPageContainer" >
              <AlbumPicker albums={this.props.albums} goToAlbum={this.props.goToAlbum} />
            </div>
            <div className="artistPageContainer" >
              <TrackPicker tracks={this.props.tracks} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  private editArtist(): void {
    this.setState({editing: true});
  }

  private confirmDelete(): void {
    this.props.deleteArtist(this.props.artistId);
    this.props.goToArtistPicker();
  }

  private deleteArtist(): void {
    this.setState({deleting: true});
  }

  private closeDelete(): void {
    this.setState({deleting: false});
  }

  private closeEdit(): void {
    this.setState({editing: false});
  }

  private runWiki(): void {
    this.props.runWikiExtension([this.props.artist.id]).then((updates) => {
      this.props.updateLibrary(updates);
    });
  }

  private runSongkick(): void {
    this.props.runSongkickExtension([this.props.artist.id]).then((updates) => {
      this.props.updateLibrary(updates);
    });
  }

  private getUpcomingEvents(): JSX.Element {
    if (!this.props.artist.songkickId) {
      return <div className="eventsContainer">Error: No songkick artist found</div>
    }
    if (!this.props.artist.events) {
      return <div className="eventsContainer">No upcoming shows</div>
    }
    return <div className="eventsContainer">
      <div>Upcoming Shows Near You:</div>
      {this.props.artist.events.map((event) => (
        <div key={event.id} onClick={() => shell.openExternal(event.uri)}>
          {event.displayName}
          <span>{(new Date(event.start.date)).toDateString()}</span>
        </div>
      ))}
    </div>
  }

  private getErrors(): JSX.Element | undefined {
    if (!this.props.artist.errors.length) {
      return;
    }
    return (
      <div className="errorsContainer" >
        <div> Errors: </div>
        {
          this.props.artist.errors.map((error) => {
            return (
              <div key={error}>{error}</div>
            );
          })
        }
      </div>

    );
  }
}

function mapStateToProps(store: RootState, ownProps: OwnProps): StateProps {
  const artist = getArtistById(store, ownProps.artistId);
  return {
    albums: getAlbumsByIds(store, artist.albumIds),
    runWikiExtension: (artistIds: string[]) => runWikiExtension(/* albumIds= */ [], artistIds, store),
    runSongkickExtension: (artistIds: string[]) => runSongkickExtension(artistIds, store),
    tracks: getTracksByIds(store, artist.trackIds),
    artist: artist,
    getGenreById: (genreId: string) => getGenreById(store, genreId),
  };
}

export default connect(mapStateToProps, {deleteArtist, updateArtist, updateLibrary})(ArtistPage);
