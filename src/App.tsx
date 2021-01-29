import {createBackup, nextAlbum, nextTrack, playPause, prevAlbum, prevTrack, resetLibrary, setPlaylist, updateLibrary,
  updateTime, updateTrack} from './redux/actions';
import {Album, Artist, LibraryInfo, LibraryState, Playlist, Track, TrackInfo} from './redux/actionTypes';
import './App.css';
import {BACKUP_TIME, DATA_DIR} from './constants';
import {ipcRenderer} from 'electron';
import EmptyPlaylist from './playlist/EmptyPlaylist';
import {createLibrary} from './library/itunes';
import {deleteLibrary, loadLibrary} from './library/main';
import runWikiExtension from './extensions/wiki/main';
import runGeniusExtension from './extensions/genius/main';
import MaxWindow from './MaxWindow';
import MiniWindow from './MiniWindow';
import RandomAlbumPlaylist from './playlist/RandomAlbumPlaylist';
import * as React from 'react';
import {connect} from 'react-redux';
import {
  getAlbumsByIds,
  getAllAlbumIds,
  getAllArtistIds,
  getAllTrackIds,
  getArtistsByIds,
  getCurrentTrack,
  getIsPlaying,
  getSetTime,
  getSyncedPlaylists,
  getTrackById,
  getVolume,
} from './redux/selectors';
import {RootState} from './redux/store';

interface StateProps {
  volume: number;
  track?: Track;
  playing: boolean;
  setTime?: number;
  getArtistsByIds(artistIds: string[]): Artist[];
  getAlbumsByIds(albumIds: string[]): Album[];
  runWikiExtension(albumIds: string[], artistIds: string[]): PromiseLike<LibraryInfo>;
  runGeniusExtension(trackIds: string[]): PromiseLike<LibraryInfo>;
  getAllTrackIds(): string[];
  getAllAlbumIds(): string[];
  getAllArtistIds(): string[];
  getSyncedPlaylists(): Playlist[];
  getTrackById(trackId: string): Track;
}

interface DispatchProps {
  updateTime(time: number): void;
  updateLibrary(library: LibraryInfo): void;
  createBackup(): void;
  resetLibrary(library: LibraryInfo): void;
  nextTrack(): void;
  prevAlbum(): void;
  prevTrack(): void;
  setPlaylist(playlist: EmptyPlaylist, play: boolean): void;
  playPause(): void;
  nextAlbum(): void;
  updateTrack(id: string, info: TrackInfo): void;
}

type AppProps = DispatchProps & StateProps;

interface AppState {
  mini: boolean;
}

class App extends React.Component<AppProps, AppState> {
  private audio: HTMLAudioElement;
  private backupTimer?: number;

  constructor(props: AppProps) {
    super(props);

    this.backupTimer = undefined;

    this.state = {
      mini: false,
    };
    ipcRenderer.on('minimize-reply', () => {
      this.onMinimize();
    });
    ipcRenderer.on('maximize-reply', () => {
      this.onMaximize();
    });
    ipcRenderer.on('toAlbum', () => {
      this.onMaximize();
    });
    ipcRenderer.on('toArtist', () => {
      this.onMaximize();
    });
    ipcRenderer.on('toTrack', () => {
      this.onMaximize();
    });
    ipcRenderer.on('nextTrack', () => {
      this.props.nextTrack();
    });
    ipcRenderer.on('prevAlbum', () => {
      this.props.prevAlbum();
    });
    ipcRenderer.on('prevTrack', () => {
      this.props.prevTrack();
    });
    ipcRenderer.on('playTrack', () => {
      this.props.playPause();
    });
    ipcRenderer.on('nextAlbum', () => {
      this.props.nextAlbum();
    });
    ipcRenderer.on('favoriteTrack', () => {
      if (!this.props.track) {
        return;
      }
      const favorites = this.props.track.favorites.slice();
      const year = new Date().getFullYear();
      const index = favorites.indexOf(year);
      if (index === -1) {
        favorites.push(year);
      } else {
        favorites.splice(index, 1);
      }
      this.props.updateTrack(this.props.track.id, {favorites});
      this.sendControllerUpdate();
    });
    ipcRenderer.on('setTime', (evt, data) => {
      this.audio.currentTime = data;
    });
    ipcRenderer.on('get-synced-playlists', (evt, plays) => {
      Object.keys(plays).forEach((trackId) => {
        const track = this.props.getTrackById(trackId);
        if (track && plays[trackId]) {
          this.props.updateTrack(track.id, {
            playCount: track.playCount + plays[trackId],
            playDate: new Date(),
          });
        }
      });
      ipcRenderer.send('synced-playlists', {playlists: this.props.getSyncedPlaylists()});
    });
    ipcRenderer.on('get-track', (evt, trackId) => {
      const data = this.props.getTrackById(trackId);
      ipcRenderer.send('get-track-' + trackId, data);
    });
    ipcRenderer.on('get-artist', (evt, artistId) => {
      const artist = this.props.getArtistsByIds([artistId])[0];
      ipcRenderer.send('get-artist-' + artistId, artist);
    });
    ipcRenderer.on('get-album', (evt, albumId) => {
      const album = this.props.getAlbumsByIds([albumId])[0];
      ipcRenderer.send('get-album-' + albumId, album);
    });
    ipcRenderer.on('run-extension', (type: {}, arg: string) => {
      switch (arg) {
      case 'wikipedia':
        this.props.runWikiExtension(this.props.getAllAlbumIds(), this.props.getAllArtistIds())
          .then((library) => {
            this.props.updateLibrary(library);
          });
        break;
      case 'genius':
        this.props.runGeniusExtension(this.props.getAllTrackIds()).then((library: LibraryInfo) => {
          this.props.updateLibrary(library);
        });
        break;
      default:
        break;
      }
    });
    ipcRenderer.on('reset-library', () => {
      deleteLibrary().then(() => {
        createLibrary().then((library: LibraryState) => {
          this.props.resetLibrary(library);
          const playlist = new RandomAlbumPlaylist(Object.values(library.albums));
          this.props.setPlaylist(playlist, /* play= */ false);
          alert('Library uploaded');
        });
      });
    });
    ipcRenderer.send('extension-ready');

    loadLibrary(`${DATA_DIR}/library.json`).then((library: LibraryState) => {
      const playlist = new RandomAlbumPlaylist(Object.values(library.albums));
      this.props.updateLibrary(library);
      this.props.setPlaylist(playlist, /* play= */ false);
    }).catch(() => {
      createLibrary().then((library) => {
        const playlist = new RandomAlbumPlaylist(Object.values(library.albums));
        this.props.resetLibrary(library);
        this.props.setPlaylist(playlist, /* play= */ false);
      });
    });

    this.audio = new Audio();
    this.audio.volume = this.props.volume;
    this.audio.addEventListener('timeupdate', () => {
      this.props.updateTime(this.audio.currentTime);
      this.sendControllerUpdate();
    });
    this.audio.addEventListener('ended', () => {
      const track = this.props.track;
      if (track) {
        this.props.updateTrack(track.id, {
          playCount: track.playCount + 1,
          playDate: new Date(),
        });
      }
      this.audio.src = '';
      this.props.nextTrack();
    });
  }

  sendControllerUpdate() {
    const artists = this.props.track ? this.props.getArtistsByIds(this.props.track.artistIds) : [];
    const albums = this.props.track ? this.props.getAlbumsByIds(this.props.track.albumIds) : [];
    ipcRenderer.send('controller-state', {
      track: this.props.track,
      artists: artists,
      albums: albums,
      currentTime: this.audio.currentTime,
      mediaState: {
        paused: this.audio.paused,
        volume: this.audio.volume,
      },
    });
  }

  componentDidMount(): void {
    this.backupTimer = window.setInterval(() => {
      this.props.createBackup();
    }, BACKUP_TIME);
  }

  componentWillUnmount(): void {
    clearInterval(this.backupTimer);
  }

  public componentDidUpdate(prevProps: AppProps): void {
    if (this.audio.volume !== this.props.volume) {
      this.audio.volume = this.props.volume;
    }
    const path = this.props.track && this.props.track.filePath;
    const prevPath = prevProps.track && prevProps.track.filePath;
    if (path && path !== prevPath) {
      this.audio.src = new URL(path).toString();
    }
    if (this.props.setTime !== undefined) {
      this.audio.currentTime = this.props.setTime;
    }
    if (this.props.playing && this.audio.paused && !this.audio.ended) {
      this.audio.play().catch(() => {});
    } else if (!this.props.playing) {
      this.audio.pause();
    }
  }

  public render(): JSX.Element {
    const mini = this.state.mini;
    // both kept on so that the subscriptions in max window stay, otherwise
    // message comes in before max window gets reattached
    // fix this better?
    return (
      <div>
        <div style={{display: mini ? 'initial' : 'none'}}>
          <MiniWindow />
        </div>
        <div style={{display: mini ? 'none' : 'initial'}}>
          <MaxWindow />
        </div>
      </div>
    );
  }

  private setTime(time: number): void {
    this.audio.currentTime = time / 1000;
  }

  private onMaximize(): void {
    this.setState({mini: false});
  }

  private onMinimize(): void {
    this.setState({mini: true});
  }

}

function mapStateToProps(store: RootState): StateProps {
  const track = getCurrentTrack(store);
  return {
    playing: getIsPlaying(store),
    runWikiExtension: (albumIds: string[], artistIds: string[]) => runWikiExtension(albumIds, artistIds, store),
    runGeniusExtension: (trackIds: string[]) => runGeniusExtension(store, trackIds),
    setTime: getSetTime(store),
    track,
    volume: getVolume(store),
    getSyncedPlaylists: () => getSyncedPlaylists(store),
    getAllArtistIds: () => getAllArtistIds(store),
    getAllAlbumIds: () => getAllAlbumIds(store),
    getAllTrackIds: () => getAllTrackIds(store),
    getArtistsByIds: (artistIds) => getArtistsByIds(store, artistIds),
    getAlbumsByIds: (albumIds) => getAlbumsByIds(store, albumIds),
    getTrackById: (trackId) => getTrackById(store, trackId),
  };
}

export default connect(mapStateToProps, {updateTime, playPause, updateLibrary, resetLibrary, nextTrack, prevAlbum,
  prevTrack, setPlaylist, updateTrack, nextAlbum, createBackup})(App);
