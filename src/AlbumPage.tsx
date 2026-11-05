import {deleteAlbum, setPlaylist, updateAlbum, updateArtist, updateLibrary, updateTrack} from './redux/actions';
import {Album, AlbumInfo, Artist, ArtistInfo, Genre, LibraryInfo, Track, TrackInfo, TrackWarning} from './redux/actionTypes';
import AlbumEditor from './AlbumEditor';
import './AlbumPage.css';
import ArtZoom from './ArtZoom';
import CoverArtLabel from './CoverArtLabel';
import EmptyPlaylist from './playlist/EmptyPlaylist';
import LikeButton from './LikeButton';
import Links from './Links';
import runWikiExtension from './extensions/wiki/main';
import runMusicBrainzExtension from './extensions/musicbrainz/main';
import runCoverArtExtension from './extensions/coverart/main';
import {boundTo, memoize} from './redux/memo';
import defaultAlbum from './resources/missing_album.png';
import MusicBrainzLabel from './MusicBrainzLabel';
import NavigationBar from './NavigationBar';
import RandomAlbumPlaylist from './playlist/RandomAlbumPlaylist';
import * as React from 'react';
import Modal from 'react-modal';
import {connect} from 'react-redux';
import runAllForAlbum, {stepNames} from './extensions/runAll';
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
  runMusicBrainzExtension(albumIds: string[]): PromiseLike<LibraryInfo>;
  runCoverArtExtension(albumIds: string[]): PromiseLike<LibraryInfo>;
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
  zooming: boolean;
  /** The extension currently running over this album, when the Run-all button is working. */
  runningStep?: string;
  runReport?: string;
}

type AlbumPageProps = OwnProps & StateProps & DispatchProps;

class AlbumPage extends React.Component<AlbumPageProps, AlbumPageState> {
  constructor(props: AlbumPageProps) {
    super(props);

    this.state = {
      deleting: false,
      editing: false,
      zooming: false,
    };
  }

  public render(): JSX.Element {
    const file = this.props.album.albumArtFile;
    const src = file ? getImgSrc(file).toString() : defaultAlbum;
    // TODO: set playTrack to play an album playlist of by artist ?
    return (
      <div className="main">
        {this.state.zooming && file && (
          <ArtZoom
            close={() => this.setState({zooming: false})}
            file={file}
            subtitle={this.props.artists.map((artist) => artist.name).join(', ')}
            title={this.props.album.name}
          />
        )}
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
            {/* clickable only when there is real art; the fallback has nothing to show */}
            <img
              alt="album art"
              className={file ? 'zoomableArt' : ''}
              height="100"
              onClick={() => file && this.setState({zooming: true})}
              src={src}
              width="100"
            />
            <div>{this.props.album.name}</div>
            <Links items={this.props.artists} goToItem={this.props.goToArtist} name="Artists" />
            <div>Total Time: {this.getTotalTime()}</div>
            <div>{this.props.album.year}</div>
            <div>{this.props.album.genreIds.map((genreId) => this.props.getGenreById(genreId).name).join(', ' )}</div>
            <WikiLabel wikiPage={this.props.album.wikiPage} onRun={() => this.runWiki()} />
            <MusicBrainzLabel
              mbid={this.props.album.mbid}
              entityType="release-group"
              onRun={() => this.runMusicBrainz()}
            />
            <CoverArtLabel album={this.props.album} onRun={() => this.runCoverArt()} />
          </div>
          <div className="albumPageControls" >
            <button onClick={() => this.playAlbum()} className="playAlbum button-primary" >Play Album</button>
            <div className="likeButtonContainer">
              <LikeButton item={this.props.album} update={this.props.updateAlbum}/>
            </div>
            <button
              className="editAlbum"
              disabled={!!this.state.runningStep}
              onClick={() => this.runAllExtensions()}
              title={`Run every extension for this album: ${stepNames().join(', ')}`}
            >
              {this.state.runningStep ? `Running ${this.state.runningStep}…` : 'Run All Extensions'}
            </button>
            {this.state.runReport && <div className="runReport">{this.state.runReport}</div>}
            <button onClick={() => this.editAlbum()} className="editAlbum" >Edit Album</button>
            <button onClick={() => this.deleteAlbum()} className="deleteAlbum button-danger">Delete Album</button>
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

  private runMusicBrainz(): void {
    this.props.runMusicBrainzExtension([this.props.album.id]).then((updates) => {
      this.props.updateLibrary(updates);
    });
  }

  /**
   * Runs the Cover Art extension for this album alone.
   *
   * Returns the promise so the label can show progress and report a failure, rather than
   * leaving a button that looks like it did nothing. The extension dispatches its own library
   * update as it goes, so this only has to apply the final delta.
   */
  private runCoverArt(): Promise<void> {
    return Promise.resolve(this.props.runCoverArtExtension([this.props.album.id]))
      .then((updates) => {
        this.props.updateLibrary(updates);
      });
  }

  /**
   * Runs every extension over this album and its tracks.
   *
   * The ordering and the store reads live in `runForAlbum` rather than here, because each step
   * needs the state the previous one produced and `this.props` is a snapshot from before any of
   * them ran.
   */
  private runAllExtensions(): void {
    this.setState({runReport: undefined, runningStep: stepNames()[0]});
    runAllForAlbum(this.props.album.id, (name) => this.setState({runningStep: name}))
      .then((failed) => {
        this.setState({
          runReport: failed.length
            ? `Finished; ${failed.join(' and ')} failed. Re-running retries them.`
            : 'All extensions finished.',
          runningStep: undefined,
        });
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

/** Each returns a new array, so both are memoised on the library and the album they read. */
const artistsOf = memoize((library: object, state: RootState, album: Album) =>
  getArtistsByIds(state, album.artistIds));
const tracksOf = memoize((library: object, state: RootState, album: Album) =>
  getTracksByIds(state, album.trackIds));
const warningsOf = memoize((library: object, state: RootState, album: Album) =>
  getWarningsFromAlbum(state, album));
/** Wrapped so the extension runners have the (state, ids) shape `boundTo` caches. */
const runWikiForAlbums = (state: RootState, albumIds: string[]) =>
  runWikiExtension(albumIds, /* artistIds= */ [], state);
const runMusicBrainzForAlbums = (state: RootState, albumIds: string[]) =>
  runMusicBrainzExtension(albumIds, /* artistIds= */ [], state);

function mapStateToProps(state: RootState, ownProps: OwnProps): StateProps {
  const library = state.library;
  const album = getAlbumById(state, ownProps.albumId);
  return {
    album,
    artists: artistsOf(library, state, album),
    getArtistByName: boundTo(library, state, getArtistByName),
    getGenreById: boundTo(library, state, getGenreById),
    getTrackById: boundTo(library, state, getTrackById),
    getTracksByIds: boundTo(library, state, getTracksByIds),
    runCoverArtExtension: boundTo(library, state, runCoverArtExtension),
    runMusicBrainzExtension: boundTo(library, state, runMusicBrainzForAlbums),
    runWikiExtension: boundTo(library, state, runWikiForAlbums),
    tracks: tracksOf(library, state, album),
    warnings: warningsOf(library, state, album),
  };
}

export default connect(mapStateToProps,
  {deleteAlbum, setPlaylist, updateAlbum, updateArtist, updateLibrary, updateTrack})(AlbumPage);
