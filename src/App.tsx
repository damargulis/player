import {nextTrack, prevTrack, setPlaylist, songEnded, updateLibrary, updateTime } from "./redux/actions";
import {DATA_DIR} from "./constants";
import {
  createLibraryFromItunes,
  deleteLibrary,
  loadLibrary,
} from "./library/create_library";
import {ipcRenderer} from "electron";
import EmptyPlaylist from "./playlist/EmptyPlaylist";
import Library from "./library/Library";
import MaxWindow from "./MaxWindow";
import MiniWindow from "./MiniWindow";
import RandomAlbumPlaylist from "./playlist/RandomAlbumPlaylist";
import * as React from "react";
import { connect } from "react-redux";
import {getCurrentTrack, getVolume} from "./redux/selectors";
import {RootState} from "./redux/store";

import "./App.css";

interface StateProps {
  volume: number;
  currentTrackId?: number;
  filePath?: string;
}

interface DispatchProps {
  updateTime(time: number): void;
  updateLibrary(library: Library): void;
  runWikiExtension(): Promise<void>;
  nextTrack(): void;
  prevTrack(): void;
  setPlaylist(playlist: EmptyPlaylist): void;
  songEnded(): void;
}

type AppProps = DispatchProps & StateProps;

interface AppState {
  mini: boolean;
  playing: boolean;
}

class App extends React.Component<AppProps, AppState> {
  private audio: HTMLAudioElement;

  constructor(props: AppProps) {
    super(props);

    this.state = {
      mini: false,
      playing: false,
    };
    ipcRenderer.on("minimize-reply", () => {
      this.onMinimize();
    });
    ipcRenderer.on("maximize-reply", () => {
      this.onMaximize();
    });
    ipcRenderer.on("toAlbum", () => {
      this.onMaximize();
    });
    ipcRenderer.on("toArtist", () => {
      this.onMaximize();
    });
    ipcRenderer.on("toSong", () => {
      this.onMaximize();
    });
    ipcRenderer.on("nextTrack", () => {
      this.props.nextTrack();
    });
    ipcRenderer.on("prevTrack", () => {
      this.props.prevTrack();
    });
    ipcRenderer.on("playTrack", () => {
      this.playPause();
    });
    ipcRenderer.on("run-extension", (type: {}, arg: string) => {
      switch (arg) {
      case "wikipedia":
        this.props.runWikiExtension();
        break;
      default:
        break;
      }
    });
    ipcRenderer.on("reset-library", () => {
      deleteLibrary().then(() => {
        createLibraryFromItunes().then((library: Library) => {
          library.save();
          this.props.updateLibrary(library);
          const playlist = new RandomAlbumPlaylist(library);
          this.props.setPlaylist(playlist);
          alert("Library uploaded");
        });
      });
    });
    ipcRenderer.send("extension-ready");

    loadLibrary(`${DATA_DIR}/library.json`).then((library: Library) => {
      const playlist = new RandomAlbumPlaylist(library);
      this.props.updateLibrary(library);
      this.props.setPlaylist(playlist);
    }).catch(() => {
      createLibraryFromItunes().then((library) => {
        const playlist = new RandomAlbumPlaylist(library);
        library.save();
        this.props.updateLibrary(library);
        this.props.setPlaylist(playlist);
      });
    });

    this.audio = new Audio();
    this.audio.volume = this.props.volume;
    this.audio.addEventListener("timeupdate", () => {
      this.props.updateTime(this.audio.currentTime);
    });
    this.audio.addEventListener("ended", () => {
      this.props.songEnded();
      // TODO: add back playcount incrmeneting
      // const track = this.state.playlist.getCurrentTrack();
      // if (!track) {
      //  return;
      // }
      // track.playCount++;
      // track.playDate = new Date();
      // this.nextTrack();
    });
  }

  public componentDidUpdate(prevProps: AppProps): void {
    console.log('did update');
    if (this.audio.volume !== this.props.volume) {
      this.audio.volume = this.props.volume;
    }
    if (this.props.filePath && this.props.filePath !== prevProps.filePath) {
      this.audio.src = new URL(this.props.filePath).toString();
    }
    if (this.props.currentTrackId && prevProps.currentTrackId !== this.props.currentTrackId) {
      this.play();
    }
  }

  public render(): JSX.Element {
    console.log('rendering');
    const mini = this.state.mini;
    // both kept on so that the subscriptions in max window stay, otherwise
    // message comes in before max window gets reattached
    // fix this better?
    return (
      <div>
        <div style={{display: mini ? "initial" : "none"}}>
          <MiniWindow
            playing={this.state.playing}
            playPause={this.playPause.bind(this)}
            setTime={this.setTime.bind(this)}
          />
        </div>
        <div style={{display: mini ? "none" : "initial"}}>
          <MaxWindow
            playing={this.state.playing}
            playPause={this.playPause.bind(this)}
            setTime={this.setTime.bind(this)}
          />
        </div>
      </div>
    );
  }

  private setTime(time: number): void {
    this.audio.currentTime = time / 1000;
  }

  private setSourceAndPlay(): void {
    this.setSource();
    this.play();
  }

  private playPause(): void {
    if (this.state.playing) {
      this.pause();
    } else {
      this.play();
    }
  }

  private play(): void {
    this.audio.play();
    this.setState({
      playing: true,
    });
  }

  private pause(): void {
    this.audio.pause();
    this.setState({
      playing: false,
    });
  }

  private setSource(): void {
    //const filePath = this.props.filePath;
    //if (filePath) {
    //  this.audio.src = new URL(filePath).toString();
    //}
  }

  private onMaximize(): void {
    this.setState({ mini: false });
  }

  private onMinimize(): void {
    this.setState({ mini: true });
  }

}

function mapStateToProps(store: RootState): StateProps {
  const track = getCurrentTrack(store);
  return {
    currentTrackId: track && track.id,
    filePath: track && track.filePath,
    volume: getVolume(store),
  };
}

export default connect(mapStateToProps, {updateTime, updateLibrary, nextTrack, prevTrack, setPlaylist, songEnded})(App);
