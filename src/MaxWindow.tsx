import {uploadFiles} from './redux/actions';
import {Album, Artist, Playlist, Track} from './redux/actionTypes';
import AlbumPage from './AlbumPage';
import AlbumPicker from './AlbumPicker';
import ArtistPage from './ArtistPage';
import ArtistPicker from './ArtistPicker';
import {ipcRenderer} from 'electron';
import GenrePicker from './GenrePicker';
import Header from './Header';
import NewTracksPage from './NewTracksPage';
import PlaylistPage from './PlaylistPage';
import PlaylistPicker from './PlaylistPicker';
import PlaylistTypePicker from './PlaylistTypePicker';
import React from 'react';
import Dropzone from 'react-dropzone';
import {connect} from 'react-redux';
import {
  getAlbumById, getAlbumsByGenres, getArtistById, getArtistsByGenres, getTracksByGenres,
} from './redux/selectors';
import {RootState} from './redux/store';
import TrackPicker from './TrackPicker';

interface StateProps {
  getAlbumById(id: string): Album;
  getArtistById(id: string): Artist;
  getTracksByGenres(genres: string[]): Track[];
  getAlbumsByGenres(genres: string[]): Album[];
  getArtistsByGenres(genres: string[]): Artist[];
}

interface DispatchProps {
  uploadFiles(files: File[]): void;
}

type MaxWindowProps = StateProps & DispatchProps;

interface MaxWindowState {
  curScene: number;
  genres: string[];
  scenes: Array<JSX.Element>;
  scrollPosition: number;
}

class MaxWindow extends React.Component<MaxWindowProps, MaxWindowState> {
  constructor(props: MaxWindowProps) {
    super(props);

    // TODO: set first scene on update library
    this.state = {
      curScene: -1,
      genres: [],
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
          goToAlbum={this.goToAlbum.bind(this)}
          goToArtist={this.goToArtist.bind(this)}
          goToTrack={this.goToTrack.bind(this)}
        />
        <div className="section">
          <div id="sidebar">
            <PlaylistTypePicker setType={this.setType.bind(this)} />
            <GenrePicker setGenres={this.setGenres.bind(this)} />
          </div>
          <Dropzone onDrop={this.onDrop.bind(this)}>
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

  private setGenres(genres: string[]): void {
    this.setState({genres});
  }

  private getPageType(type: string): JSX.Element {
    switch (type) {
    case 'album':
      return (
        <AlbumPicker
          albums={this.props.getAlbumsByGenres(this.state.genres)}
          goToAlbum={this.goToAlbum.bind(this)}
          scrollPosition={this.state.scrollPosition}
        />
      );
    case 'artist':
      return (
        <ArtistPicker
          artists={this.props.getArtistsByGenres(this.state.genres)}
          goToArtist={this.goToArtist.bind(this)}
          scrollPosition={this.state.scrollPosition}
        />
      );
    case 'track':
      return <TrackPicker tracks={this.props.getTracksByGenres(this.state.genres)} />;
    case 'playlist':
      return <PlaylistPicker goToPlaylist={this.goToPlaylist.bind(this)} />;
    case 'new':
      return <NewTracksPage />;
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
        tracks={this.props.getTracksByGenres(this.state.genres)}
      />,
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
        goBack={this.goBack.bind(this)}
        goForward={this.goForward.bind(this)}
        goToArtist={this.goToArtist.bind(this)}
        goToAlbumPicker={() => this.setType('album')}
      />,
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
        goBack={this.goBack.bind(this)}
        goForward={this.goForward.bind(this)}
        goToAlbum={this.goToAlbum.bind(this)}
        goToArtistPicker={() => this.setType('artist')}
      />,

    );
    const curScene = this.state.curScene + 1;
    this.setState({scenes, curScene});
  }

  private goToPlaylist(playlist: Playlist): void {
    const scenes = this.state.scenes.slice(0, this.state.curScene + 1);
    scenes.push(
      <PlaylistPage
        canGoForward={this.canGoForward()}
        genres={[]}
        goBack={this.goBack.bind(this)}
        goForward={this.goForward.bind(this)}
        playlist={playlist}
      />,
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
        <div key={i} style={{display: (i == this.state.curScene) ? 'initial' : 'none'}}>
            {el}
        </div>
      );
    });
  }
}

function mapStateToProps(store: RootState): StateProps {
  return {
    getAlbumById: (id: string) => getAlbumById(store, id),
    getAlbumsByGenres: (genres: string[]) => getAlbumsByGenres(store, genres),
    getArtistById: (id: string) => getArtistById(store, id),
    getArtistsByGenres: (genres: string[]) => getArtistsByGenres(store, genres),
    getTracksByGenres: (genres: string[]) => getTracksByGenres(store, genres),
  };
}

export default connect(mapStateToProps, {uploadFiles})(MaxWindow);
