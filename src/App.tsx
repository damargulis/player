import {nextTrack, prevTrack, setPlaylist, updateLibrary, updateTime, updateTrack} from './redux/actions';
import {LibraryState, Track, TrackInfo} from './redux/actionTypes';
import './App.css';
import {DATA_DIR} from './constants';
import {createLibraryFromItunes} from './library/itunes';
import {deleteLibrary, loadLibrary} from './library/main';
import {ipcRenderer} from 'electron';
import EmptyPlaylist from './playlist/EmptyPlaylist';
import runWikiExtension from './extensions/wiki/main';
import MaxWindow from './MaxWindow';
import MiniWindow from './MiniWindow';
import RandomAlbumPlaylist from './playlist/RandomAlbumPlaylist';
import * as React from 'react';
import {connect} from 'react-redux';
import {getCurrentTrack, getIsPlaying, getSetTime, getVolume} from './redux/selectors';
import {RootState} from './redux/store';

interface StateProps {
  volume: number;
  track?: Track;
  playing: boolean;
  setTime?: number;
  runWikiExtension(): PromiseLike<LibraryState>;
}

interface DispatchProps {
  updateTime(time: number): void;
  updateLibrary(library: LibraryState): void;
  nextTrack(): void;
  prevTrack(): void;
  setPlaylist(playlist: EmptyPlaylist, play: boolean): void;
  playPause(): void;
  updateTrack(id: string, info: TrackInfo): void;
}

type AppProps = DispatchProps & StateProps;

interface AppState {
  mini: boolean;
}

class App extends React.Component<AppProps, AppState> {
  private audio: HTMLAudioElement;

  constructor(props: AppProps) {
    super(props);

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
    ipcRenderer.on('prevTrack', () => {
      this.props.prevTrack();
    });
    ipcRenderer.on('playTrack', () => {
      this.props.playPause();
    });
    ipcRenderer.on('run-extension', (type: {}, arg: string) => {
      switch (arg) {
      case 'wikipedia':
        this.props.runWikiExtension().then((library: LibraryState) => {
          this.props.updateLibrary(library);
        });
        break;
      default:
        break;
      }
    });
    ipcRenderer.on('reset-library', () => {
      deleteLibrary().then(() => {
        createLibraryFromItunes().then((library: LibraryState) => {
          this.props.updateLibrary(library);
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
      createLibraryFromItunes().then((library) => {
        const playlist = new RandomAlbumPlaylist(Object.values(library.albums));
        this.props.updateLibrary(library);
        this.props.setPlaylist(playlist, /* play= */ false);
      });
    });

    this.audio = new Audio();
    this.audio.volume = this.props.volume;
    this.audio.addEventListener('timeupdate', () => {
      this.props.updateTime(this.audio.currentTime);
    });
    this.audio.addEventListener('ended', () => {
      const track = this.props.track;
      if (track) {
        this.props.updateTrack(track.id, {
          playCount: track.playCount + 1,
          playDate: new Date(),
        });
      }
      this.props.nextTrack();
    });
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
    if (this.props.playing) {
      this.audio.play();
    } else {
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
    runWikiExtension: () => runWikiExtension(store),
    setTime: getSetTime(store),
    track,
    volume: getVolume(store),
  };
}

export default connect(mapStateToProps,
  {updateTime, updateLibrary, nextTrack, prevTrack, setPlaylist, updateTrack})(App);
