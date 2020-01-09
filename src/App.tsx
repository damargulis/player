import {DATA_DIR} from "./constants";
import {
  createLibraryFromItunes,
  deleteLibrary,
  loadLibrary,
} from "./library/create_library";
import {ipcRenderer} from "electron";
import EmptyPlaylist from "./playlist/EmptyPlaylist";
import Library from "./library/Library";
import runWikiExtension from "./extensions/wiki/main";
import MaxWindow from "./MaxWindow";
import MiniWindow from "./MiniWindow";
import RandomAlbumPlaylist from "./playlist/RandomAlbumPlaylist";
import * as React from "react";

import "./App.css";

const DEFAULT_VOLUME = .1;

interface AppState {
  library: Library;
  mini: boolean;
  playlist: EmptyPlaylist;
  playing: boolean;
  time: number;
}

export default class App extends React.Component<{}, AppState> {
  private audio: HTMLAudioElement;

  constructor(props: {}) {
    super(props);

    this.state = {
      library: new Library(),
      mini: false,
      playing: false,
      playlist: new EmptyPlaylist(),
      time: 0,
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
        runWikiExtension(this.state.library).then(() => {
          this.state.library.save();
          this.setState({library: this.state.library});
        });
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
            library,
            playlist,
          });
          alert("Library uploaded");
        });
      });
    });
    ipcRenderer.send("extension-ready");

    loadLibrary(`${DATA_DIR}/library.json`).then((library: Library) => {
      const playlist = new RandomAlbumPlaylist(library);
      this.setState({
        library,
        playlist,
      });
    }).catch(() => {
      createLibraryFromItunes().then((library) => {
        const playlist = new RandomAlbumPlaylist(library);
        library.save();
        this.setState({
          library,
          playlist,
        });
      });
    });

    this.audio = new Audio();
    this.audio.volume = DEFAULT_VOLUME;
    this.audio.addEventListener("timeupdate", () => {
      this.setState({
        time: this.audio.currentTime,
      });
    });
    this.audio.addEventListener("ended", () => {
      const track = this.state.playlist.getCurrentTrack();
      if (!track) {
        return;
      }
      track.playCount++;
      track.playDate = new Date();
      this.setState({library: this.state.library});
      this.nextTrack();
      this.state.library.save();
    });
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
            library={this.state.library}
            nextAlbum={this.nextAlbum.bind(this)}
            nextTrack={this.nextTrack.bind(this)}
            playing={this.state.playing}
            playlist={this.state.playlist}
            playPause={this.playPause.bind(this)}
            prevAlbum={this.prevAlbum.bind(this)}
            prevTrack={this.prevTrack.bind(this)}
            setTime={this.setTime.bind(this)}
            setVolume={this.setVolume.bind(this)}
            time={this.state.time}
            volume={this.audio.volume}
          />
        </div>
        <div style={{display: mini ? "none" : "initial"}}>
          <MaxWindow
            library={this.state.library}
            nextAlbum={this.nextAlbum.bind(this)}
            nextTrack={this.nextTrack.bind(this)}
            playing={this.state.playing}
            playlist={this.state.playlist}
            playPause={this.playPause.bind(this)}
            prevAlbum={this.prevAlbum.bind(this)}
            prevTrack={this.prevTrack.bind(this)}
            setPlaylistAndPlay={this.setPlaylistAndPlay.bind(this)}
            setTime={this.setTime.bind(this)}
            setVolume={this.setVolume.bind(this)}
            time={this.state.time}
            volume={this.audio.volume}
          />
        </div>
      </div>
    );
  }

  private setVolume(volume: number): void {
    this.audio.volume = volume;
    this.setState({});
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
