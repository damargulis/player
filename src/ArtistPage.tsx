import {deleteArtist, updateArtist, updateLibrary} from './redux/actions';
import {Album, Artist, ArtistInfo, Genre, LibraryInfo, Track} from './redux/actionTypes';
import AlbumPicker from './AlbumPicker';
import ArtistConcerts from './ArtistConcerts';
import ArtistEditor from './ArtistEditor';
import './ArtistPage.css';
import ArtistPicLabel from './ArtistPicLabel';
import {removeArtistArt} from './artRemoval';
import ArtZoom from './ArtZoom';
import runWikiExtension from './extensions/wiki/main';
import runMusicBrainzExtension from './extensions/musicbrainz/main';
import {boundTo, memoize} from './redux/memo';
import defaultArtist from './resources/missing_artist.png';
import MusicBrainzLabel from './MusicBrainzLabel';
import NavigationBar from './NavigationBar';
import React from 'react';
import Modal from 'react-modal';
import {connect} from 'react-redux';
import {artistStepNames, runAllForArtist} from './extensions/runAll';
import {getAlbumsByIds, getArtistById, getGenreById, getTracksByIds} from './redux/selectors';
import reduxStore, {RootState} from './redux/store';
import TrackPicker from './TrackPicker';
import {getImgSrc} from './utils';
import WikiLabel from './WikiLabel';

interface StateProps {
  albums: Album[];
  tracks: Track[];
  artist: Artist;
  runWikiExtension(artistIds: string[]): PromiseLike<LibraryInfo>;
  runMusicBrainzExtension(artistIds: string[]): PromiseLike<LibraryInfo>;
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
  zooming: boolean;
  /** The extension currently running over this artist, when Run-all is working. */
  runningStep?: string;
  runReport?: string;
}

class ArtistPage extends React.Component<ArtistPageProps, ArtistPageState> {
  constructor(props: ArtistPageProps) {
    super(props);

    this.state = {
      deleting: false,
      editing: false,
      zooming: false,
    };
  }

  public render(): JSX.Element {
    const file = this.props.artist.artFile;
    const src = file ? getImgSrc(file) : defaultArtist;
    return (
      <div className="main">
        {this.state.zooming && file && (
          <ArtZoom
            close={() => this.setState({zooming: false})}
            file={file}
            onRemove={() => this.removeArt()}
            title={this.props.artist.name}
          />
        )}
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
              <img
                alt="artist art"
                className={file ? 'zoomableArt' : ''}
                height="100"
                onClick={() => file && this.setState({zooming: true})}
                src={src}
                width="100"
              />
              <div>{this.props.artist.name}</div>
              <div>{this.props.artist.genreIds.map((genreId) => this.props.getGenreById(genreId).name).join(', ')}</div>
              <WikiLabel wikiPage={this.props.artist.wikiPage} onRun={() => this.runWiki()} />
              <ArtistPicLabel artist={this.props.artist} />
              <MusicBrainzLabel
                mbid={this.props.artist.mbid}
                entityType="artist"
                onRun={() => this.runMusicBrainz()}
              />
              <ArtistConcerts artistId={this.props.artist.id} />
            </div>
            <button
              className="editArtist"
              disabled={!!this.state.runningStep}
              onClick={() => this.runAllExtensions()}
              title={`Run every extension for this artist, their albums and their tracks: ` +
                artistStepNames().join(', ')}
            >
              {this.state.runningStep ? `Running ${this.state.runningStep}…` : 'Run All Extensions'}
            </button>
            {this.state.runReport && <div className="runReport">{this.state.runReport}</div>}
            <button onClick={() => this.editArtist()} className="editArtist" >Edit Artist</button>
            <button onClick={() => this.deleteArtist()} className="deleteArtist button-danger">Delete Artist</button>
            {this.getErrors()}
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

  /**
   * Runs every extension over this artist, their albums and their tracks.
   *
   * Potentially a long run — the biggest artist in this library has 253 tracks — so the step
   * being worked on is shown throughout and the track count goes in the report.
   */
  private runAllExtensions(): void {
    this.setState({runReport: undefined, runningStep: artistStepNames()[0]});
    const tracks = this.props.artist.trackIds.length;
    runAllForArtist(this.props.artistId, (name) => this.setState({runningStep: name}))
      .then((failed) => {
        this.setState({
          runReport: failed.length
            ? `Finished ${tracks} tracks; ${failed.join(' and ')} failed. Re-running retries them.`
            : `All extensions finished over ${tracks} tracks.`,
          runningStep: undefined,
        });
      });
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

  /**
   * Takes the picture off this artist and deletes the file.
   *
   * This is the case that asked for it: a MusicBrainz match that turned out to be the wrong
   * artist leaves a picture behind, and clearing the mbid does not remove it — nothing in the
   * app ever deleted an image, because every writer only replaces one with a bigger one.
   */
  private removeArt(): void {
    this.props.updateArtist(this.props.artist.id, removeArtistArt(reduxStore.getState(), this.props.artist));
  }

  private runWiki(): void {
    this.props.runWikiExtension([this.props.artist.id]).then((updates) => {
      this.props.updateLibrary(updates);
    });
  }

  private runMusicBrainz(): void {
    this.props.runMusicBrainzExtension([this.props.artist.id]).then((updates) => {
      this.props.updateLibrary(updates);
    });
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

const albumsOf = memoize((library: object, store: RootState, artist: Artist) =>
  getAlbumsByIds(store, artist.albumIds));
const artistTracksOf = memoize((library: object, store: RootState, artist: Artist) =>
  getTracksByIds(store, artist.trackIds));
const runWikiForArtists = (store: RootState, artistIds: string[]) =>
  runWikiExtension(/* albumIds= */ [], artistIds, store);
const runMusicBrainzForArtists = (store: RootState, artistIds: string[]) =>
  runMusicBrainzExtension(/* albumIds= */ [], artistIds, store);

function mapStateToProps(store: RootState, ownProps: OwnProps): StateProps {
  const library = store.library;
  const artist = getArtistById(store, ownProps.artistId);
  return {
    albums: albumsOf(library, store, artist),
    artist,
    getGenreById: boundTo(library, store, getGenreById),
    runMusicBrainzExtension: boundTo(library, store, runMusicBrainzForArtists),
    runWikiExtension: boundTo(library, store, runWikiForArtists),
    tracks: artistTracksOf(library, store, artist),
  };
}

export default connect(mapStateToProps, {deleteArtist, updateArtist, updateLibrary})(ArtistPage);
