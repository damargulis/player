import {AlbumParams, Artist, PlaylistParams, Track} from './redux/actionTypes';
import AlbumPage from './AlbumPage';
import AlbumPicker from './AlbumPicker';
import ArtistPage from './ArtistPage';
import ArtistPicker from './ArtistPicker';
import {ipcRenderer} from 'electron';
import GenrePicker from './GenrePicker';
import Header from './Header';
import PlaylistPage from './PlaylistPage';
import PlaylistPicker from './PlaylistPicker';
import PlaylistTypePicker from './PlaylistTypePicker';
import React from 'react';
import {connect} from 'react-redux';
import {
  getAlbumById, getAlbumsByGenres, getArtistById, getArtistsByGenres, getTracksByGenres,
} from './redux/selectors';
import SongPicker from './SongPicker';
import {RootState} from './redux/store';

interface StateProps {
  getAlbumById(id: number): AlbumParams;
  getArtistById(id: number): Artist;
  getTracksByGenres(genres: number[]): Track[];
  getAlbumsByGenres(genres: number[]): AlbumParams[];
  getArtistsByGenres(genres: number[]): Artist[];
}

type MaxWindowProps = StateProps;

interface MaxWindowState {
  curScene: number;
  genres: number[];
  playlistType: string;
  scenes: Array<(genres: number[]) => JSX.Element>;
}

class MaxWindow extends React.Component<MaxWindowProps, MaxWindowState> {
  constructor(props: MaxWindowProps) {
    super(props);

    this.state = {
      curScene: -1,
      genres: [],
      playlistType: 'album',
      scenes: [],
    };
    this.onArtistMessage = this.onArtistMessage.bind(this);
    this.onAlbumMessage = this.onAlbumMessage.bind(this);
    ipcRenderer.on('toArtist', this.onArtistMessage);
    ipcRenderer.on('toAlbum', this.onAlbumMessage);
    ipcRenderer.on('toSong', this.onSongMessage.bind(this));
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
          goToSong={this.goToSong.bind(this)}
        />
        <div className="section">
          <div id="sidebar">
            <PlaylistTypePicker setType={this.setType.bind(this)} />
            <GenrePicker setGenres={this.setGenres.bind(this)} />
          </div>
          {this.getPicker()}
        </div>
      </div>
    );
  }

  private onSongMessage(evt: Event, data: {song: Track}): void {
    this.goToSong(data.song);
  }

  private onAlbumMessage(evt: Event, data: {album: AlbumParams}): void {
    const album = this.props.getAlbumById(data.album.id);
    this.goToAlbum(album);
  }

  private onArtistMessage(evt: Event, data: {artist: Artist}): void {
    const artist = this.props.getArtistById(data.artist.id);
    this.goToArtist(artist);
  }

  private setGenres(genres: number[]): void {
    this.setState({genres});
  }

  private setType(type: string): void {
    this.setState({
      curScene: -1,
      playlistType: type,
      scenes: [],
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

  private goToSong(song: Track): void {
    const scenes = this.state.scenes.slice(0, this.state.curScene + 1);
    scenes.push(
      () => <SongPicker
        scrollToSongId={song.id}
        songs={this.props.getTracksByGenres(this.state.genres)}
      />,
    );
    const curScene = this.state.curScene + 1;
    this.setState({scenes, curScene});
  }

  private goToAlbum(album: AlbumParams): void {
    const scenes = this.state.scenes.slice(0, this.state.curScene + 1);
    scenes.push(
      () => <AlbumPage
        album={album}
        canGoForward={this.canGoForward()}
        goBack={this.goBack.bind(this)}
        goForward={this.goForward.bind(this)}
        goToArtist={this.goToArtist.bind(this)}
      />,
    );
    const curScene = this.state.curScene + 1;
    this.setState({scenes, curScene});
  }

  private goToArtist(artist: Artist): void {
    const scenes = this.state.scenes.slice(0, this.state.curScene + 1);
    scenes.push(
      () => <ArtistPage
        artist={artist}
        canGoForward={this.canGoForward()}
        goBack={this.goBack.bind(this)}
        goForward={this.goForward.bind(this)}
        goToAlbum={this.goToAlbum.bind(this)}
      />,

    );
    const curScene = this.state.curScene + 1;
    this.setState({scenes, curScene});
  }

  private goToPlaylist(playlist: PlaylistParams): void {
    const scenes = this.state.scenes.slice(0, this.state.curScene + 1);
    scenes.push(
      (genres) => <PlaylistPage
        canGoForward={this.canGoForward()}
        genres={genres}
        goBack={this.goBack.bind(this)}
        goForward={this.goForward.bind(this)}
        playlist={playlist}
      />,

    );
    const curScene = this.state.curScene + 1;
    this.setState({scenes, curScene});
  }

  private getPicker(): JSX.Element | undefined {
    if (this.state.curScene >= 0) {
      return this.state.scenes[this.state.curScene](this.state.genres);
    }
    switch (this.state.playlistType) {
    case 'album':
      return (
        <AlbumPicker albums={this.props.getAlbumsByGenres(this.state.genres)} goToAlbum={this.goToAlbum.bind(this)} />
      );
    case 'artist':
      return (
        <ArtistPicker
          artists={this.props.getArtistsByGenres(this.state.genres)}
          goToArtist={this.goToArtist.bind(this)}
        />
      );
    case 'song':
      return <SongPicker songs={this.props.getTracksByGenres(this.state.genres)} />;
    case 'playlist':
      return <PlaylistPicker goToPlaylist={this.goToPlaylist.bind(this)} />;
    default:
      return;
    }
  }
}

function mapStateToProps(store: RootState): StateProps {
  return {
    getAlbumById: (id: number) => getAlbumById(store, id),
    getAlbumsByGenres: (genres: number[]) => getAlbumsByGenres(store, genres),
    getArtistById: (id: number) => getArtistById(store, id),
    getArtistsByGenres: (genres: number[]) => getArtistsByGenres(store, genres),
    getTracksByGenres: (genres: number[]) => getTracksByGenres(store, genres),
  };
}

export default connect(mapStateToProps)(MaxWindow);
