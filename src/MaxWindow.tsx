import {uploadFiles} from './redux/actions';
import {Album, Artist, Playlist, Track} from './redux/actionTypes';
import AlbumPage from './AlbumPage';
import AlbumPicker from './AlbumPicker';
import ArtistPage from './ArtistPage';
import ArtistPicker from './ArtistPicker';
import ConcertsPage from './ConcertsPage';
import DJPage from './DJPage';
import {ipcRenderer} from 'electron';
import GenrePicker from './GenrePicker';
import Header from './Header';
import {boundTo} from './redux/memo';
import NewTracksPage from './NewTracksPage';
import PlaylistPage from './PlaylistPage';
import PlaylistPicker from './PlaylistPicker';
import PlaylistTypePicker from './PlaylistTypePicker';
import React from 'react';
import Dropzone from 'react-dropzone';
import {connect} from 'react-redux';
import {
  getAlbumById, getAllAlbums, getAllArtists, getAllTracks, getArtistById,
} from './redux/selectors';
import StatsPage from './StatsPage';
import {RootState} from './redux/store';
import TrackPicker from './TrackPicker';

interface StateProps {
  getAlbumById(id: string): Album;
  getArtistById(id: string): Artist;
  getAllTracks(): Track[];
  getAllAlbums(): Album[];
  getAllArtists(): Artist[];
}

interface DispatchProps {
  uploadFiles(files: File[]): void;
}

type MaxWindowProps = StateProps & DispatchProps;

interface MaxWindowState {
  curScene: number;
  scenes: JSX.Element[];
  scrollPosition: number;
}

class MaxWindow extends React.Component<MaxWindowProps, MaxWindowState> {
  constructor(props: MaxWindowProps) {
    super(props);

    // TODO: set first scene on update library
    this.state = {
      curScene: -1,
      scenes: [],
      scrollPosition: -1,
    };
    this.onArtistMessage = this.onArtistMessage.bind(this);
    this.onAlbumMessage = this.onAlbumMessage.bind(this);
    ipcRenderer.on('toArtist', this.onArtistMessage);
    ipcRenderer.on('toAlbum', this.onAlbumMessage);
    ipcRenderer.on('toTrack', this.onTrackMessage.bind(this));
  }

  public componentWillUnmount(): void {
    ipcRenderer.removeListener('toArtist', this.onArtistMessage);
  }

  public render(): JSX.Element {
    return (
      <div id="max-window" >
        <Header
          goToAlbum={(albumId) => this.goToAlbum(albumId)}
          goToArtist={(artistId) => this.goToArtist(artistId)}
          goToTrack={(trackId) => this.goToTrack(trackId)}
        />
        <div className="section">
          <div id="sidebar">
            <PlaylistTypePicker setType={(type) => this.setType(type)} />
            <GenrePicker />
          </div>
          <Dropzone onDrop={(files) => this.onDrop(files)}>
            {({getRootProps, getInputProps}) => (
              <div {...getRootProps({onClick: (evt) => evt.stopPropagation()})} style={{width: '100%'}}>
                <input {...getInputProps()} />
                {this.getPicker()}
              </div>
            )}
          </Dropzone>
        </div>
      </div>
    );
  }

  private onDrop(files: File[]): void {
    this.props.uploadFiles(files);
    this.setType('new');
  }

  private onTrackMessage(evt: Event, data: {trackId: string}): void {
    this.goToTrack(data.trackId);
  }

  private onAlbumMessage(evt: Event, data: {albumId: string}): void {
    this.goToAlbum(data.albumId);
  }

  private onArtistMessage(evt: Event, data: {artistId: string}): void {
    this.goToArtist(data.artistId);
  }

  private getPageType(type: string): JSX.Element {
    switch (type) {
    case 'album':
      return (
        <AlbumPicker
          albums={this.props.getAllAlbums()}
          goToAlbum={(albumId) => this.goToAlbum(albumId)}
          scrollPosition={this.state.scrollPosition}
        />
      );
    case 'artist':
      return (
        <ArtistPicker
          artists={this.props.getAllArtists()}
          goToArtist={(artistId) => this.goToArtist(artistId)}
          scrollPosition={this.state.scrollPosition}
        />
      );
    case 'track':
      return <TrackPicker tracks={this.props.getAllTracks()} />;
    case 'playlist':
    return <PlaylistPicker goToPlaylist={(playlist) => this.goToPlaylist(playlist)} />;
    case 'new':
      return <NewTracksPage />;
    case 'dj':
      return <DJPage />;
    case 'concerts':
      return <ConcertsPage goToArtist={(artistId) => this.goToArtist(artistId)} />;
    case 'stats':
      return (
        <StatsPage
          goToAlbum={(albumId) => this.goToAlbum(albumId)}
          goToArtist={(artistId) => this.goToArtist(artistId)}
          goToTrack={(trackId) => this.goToTrack(trackId)}
        />
      );
    default:
    return <></>;
    }
  }

  private setType(type: string): void {
    const page = this.getPageType(type);
    this.setState({scenes: []}, () => {
      this.setState({
        curScene: 0,
        scenes: [page],
        scrollPosition: -1,
      });
    });
  }

  private goBack(): void {
    this.setState({curScene: this.state.curScene - 1});
  }

  private goForward(): void {
    this.setState({curScene: this.state.curScene + 1});
  }

  private canGoForward(): boolean {
    return this.state.curScene < this.state.scenes.length - 1;
  }

  private goToTrack(trackId: string): void {
    const scenes = this.state.scenes.slice(0, this.state.curScene + 1);
    scenes.push(
      <TrackPicker
        scrollToTrackId={trackId}
        tracks={this.props.getAllTracks()}
      />
    );
    const curScene = this.state.curScene + 1;
    this.setState({scenes, curScene});
  }

  private goToAlbum(albumId: string): void {
    const scenes = this.state.scenes.slice(0, this.state.curScene + 1);
    scenes.push(
      <AlbumPage
        albumId={albumId}
        canGoForward={this.canGoForward()}
        goBack={() => this.goBack()}
        goForward={() => this.goForward()}
        goToArtist={(artistId) => this.goToArtist(artistId)}
        goToAlbumPicker={() => this.setType('album')}
      />
    );
    const curScene = this.state.curScene + 1;
    this.setState({scenes, curScene});
  }

  private goToArtist(artistId: string): void {
    const scenes = this.state.scenes.slice(0, this.state.curScene + 1);
    scenes.push(
      <ArtistPage
        artistId={artistId}
        canGoForward={this.canGoForward()}
        goBack={() => this.goBack()}
        goForward={() => this.goForward()}
        goToAlbum={(albumId) => this.goToAlbum(albumId)}
        goToArtistPicker={() => this.setType('artist')}
      />
    );
    const curScene = this.state.curScene + 1;
    this.setState({scenes, curScene});
  }

  private goToPlaylist(playlist: Playlist): void {
    const scenes = this.state.scenes.slice(0, this.state.curScene + 1);
    scenes.push(
      <PlaylistPage
        canGoForward={this.canGoForward()}
        goBack={() => this.goBack()}
        goForward={() => this.goForward()}
        playlist={playlist}
      />
    );
    const curScene = this.state.curScene + 1;
    this.setState({scenes, curScene});
  }

  private setScroll(position: number): void {
    this.setState({scrollPosition: position});
  }

  private getPicker(): JSX.Element[] {
    return this.state.scenes.map((el, i) => {
      return (
        <div key={i} style={{display: (i === this.state.curScene) ? 'initial' : 'none'}}>
            {el}
        </div>
      );
    });
  }
}

/**
 * Every one of these reads only `store.library`, so binding them to that slice keeps the props
 * identical while the library is unchanged — which is every `timeupdate` during playback.
 * Without it this component, and therefore the whole browser tree, re-rendered four times a
 * second for nothing.
 */
function mapStateToProps(store: RootState): StateProps {
  const library = store.library;
  return {
    getAlbumById: boundTo(library, store, getAlbumById),
    getAllAlbums: boundTo(library, store, getAllAlbums),
    getArtistById: boundTo(library, store, getArtistById),
    getAllArtists: boundTo(library, store, getAllArtists),
    getAllTracks: boundTo(library, store, getAllTracks),
  };
}

export default connect(mapStateToProps, {uploadFiles})(MaxWindow);
