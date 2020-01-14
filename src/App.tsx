import {updateLibrary, updateTime } from "./redux/actions";
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
import {getVolume} from "./redux/selectors";
import {RootState} from "./redux/store";

import "./App.css";

interface StateProps {
  volume: number;
}

interface DispatchProps {
  updateTime(time: number): void;
  updateLibrary(library: Library): void;
  runWikiExtension(): Promise<void>;
}

type AppProps = DispatchProps & StateProps;

interface AppState {
  mini: boolean;
  playlist: EmptyPlaylist;
  playing: boolean;
}

class App extends React.Component<AppProps, AppState> {
  private audio: HTMLAudioElement;

  constructor(props: AppProps) {
    super(props);

    this.state = {
      mini: false,
      playing: false,
      playlist: new EmptyPlaylist(),
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
      this.nextTrack();
    });
    ipcRenderer.on("prevTrack", () => {
      this.prevTrack();
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
          const playlist = new RandomAlbumPlaylist(library);
          library.save();
          this.setState({
            playlist,
          });
          this.props.updateLibrary(library);
          alert("Library uploaded");
        });
      });
    });
    ipcRenderer.send("extension-ready");

    loadLibrary(`${DATA_DIR}/library.json`).then((library: Library) => {
      const playlist = new RandomAlbumPlaylist(library);
      this.props.updateLibrary(library);
      this.setState({
        playlist,
      });
    }).catch(() => {
      createLibraryFromItunes().then((library) => {
        const playlist = new RandomAlbumPlaylist(library);
        library.save();
        this.props.updateLibrary(library);
        this.setState({
          playlist,
        });
      });
    });

    this.audio = new Audio();
    this.audio.volume = this.props.volume;
    this.audio.addEventListener("timeupdate", () => {
      this.props.updateTime(this.audio.currentTime);
    });
    this.audio.addEventListener("ended", () => {
      const track = this.state.playlist.getCurrentTrack();
      if (!track) {
        return;
      }
      track.playCount++;
      track.playDate = new Date();
      this.nextTrack();
    });
  }

  public componentDidUpdate(): void {
    this.audio.volume = this.props.volume;
  }

  public render(): JSX.Element {
    const mini = this.state.mini;
    // both kept on so that the subscriptions in max window stay, otherwise
    // message comes in before max window gets reattached
    // fix this better?
    return (
      <div>
        <div style={{display: mini ? "initial" : "none"}}>
          <MiniWindow
            nextAlbum={this.nextAlbum.bind(this)}
            nextTrack={this.nextTrack.bind(this)}
            playing={this.state.playing}
            playlist={this.state.playlist}
            playPause={this.playPause.bind(this)}
            prevAlbum={this.prevAlbum.bind(this)}
            prevTrack={this.prevTrack.bind(this)}
            setTime={this.setTime.bind(this)}
          />
        </div>
        <div style={{display: mini ? "none" : "initial"}}>
          <MaxWindow
            nextAlbum={this.nextAlbum.bind(this)}
            nextTrack={this.nextTrack.bind(this)}
            playing={this.state.playing}
            playlist={this.state.playlist}
            playPause={this.playPause.bind(this)}
            prevAlbum={this.prevAlbum.bind(this)}
            prevTrack={this.prevTrack.bind(this)}
            setPlaylistAndPlay={this.setPlaylistAndPlay.bind(this)}
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
    const track = this.state.playlist.getCurrentTrack();
    if (track) {
      this.audio.src = new URL(track.filePath).toString();
    }
  }

  private onMaximize(): void {
    this.setState({ mini: false });
  }

  private onMinimize(): void {
    this.setState({ mini: true });
  }

  private nextTrack(): void {
    this.state.playlist.nextTrack();
    this.setSourceAndPlay();
  }

  private nextAlbum(): void {
    this.state.playlist.nextAlbum();
    this.setSourceAndPlay();
  }

  private prevAlbum(): void {
    this.state.playlist.prevAlbum();
    this.setSourceAndPlay();
  }

  private prevTrack(): void {
    this.state.playlist.prevTrack();
    this.setSourceAndPlay();
  }

  private setPlaylistAndPlay(playlist: EmptyPlaylist): void {
    this.setState({playlist}, () => this.nextTrack());
  }
}

function mapStateToProps(store: RootState): StateProps {
  return {
    volume: getVolume(store),
  };
}

export default connect(mapStateToProps, {updateTime, updateLibrary})(App);
