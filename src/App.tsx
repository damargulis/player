import EmptyPlaylist from './playlist/EmptyPlaylist';
import Library from './library/Library';
import MaxWindow from './MaxWindow';
import MiniWindow from './MiniWindow';
import RandomAlbumPlaylist from './playlist/RandomAlbumPlaylist';
import * as React from 'react';
import runWikiExtension from './extensions/wiki/main';
import {
  createLibraryFromItunes,
  deleteLibrary,
  loadLibrary
} from './library/create_library';

import './App.css';

const {ipcRenderer} = require('electron');

const DEFAULT_VOLUME = .1;

interface AppState {
  library: Library;
  mini: boolean;
  playlist: EmptyPlaylist;
  playing: boolean;
  time: number;
}

export default class App extends React.Component<{},AppState> {
  audio: HTMLAudioElement;

  constructor() {
    super({});
    this.state = {
      mini: false,
      library: new Library(),
      playlist: new EmptyPlaylist(),
      playing: false,
      time: 0,
    };
    ipcRenderer.on('minimize-reply', () => {
      this.onMinimize_();
    });
    ipcRenderer.on('maximize-reply', () => {
      this.onMaximize_();
    });
    ipcRenderer.on('toAlbum', () => {
      this.onMaximize_();
    });
    ipcRenderer.on('toArtist', () => {
      this.onMaximize_();
    });
    ipcRenderer.on('toSong', () => {
      this.onMaximize_();
    });
    ipcRenderer.on('nextTrack', () => {
      this.nextTrack();
    });
    ipcRenderer.on('prevTrack', () => {
      this.prevTrack();
    });
    ipcRenderer.on('playTrack', () => {
      this.playPause();
    });
    ipcRenderer.on('run-extension', (type: {}, arg: string) => {
      switch (arg) {
      case 'wikipedia':
        runWikiExtension(this.state.library).then(() => {
          this.state.library.save();
          this.setState({library: this.state.library});
        }).catch(() => {});
        break;
      default:
        break;
      }
    });
    ipcRenderer.on('reset-library', () => {
      deleteLibrary().then(() => {
        createLibraryFromItunes().then((library: Library) => {
          const playlist = new RandomAlbumPlaylist(library);
          library.save();
          this.setState({
            library,
            playlist
          });
        });
      });
    });
    ipcRenderer.send('extension-ready');

    loadLibrary('data/library.json').then((library: Library) => {
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
          playlist
        });
      });
    });

    this.audio = new Audio();
    this.audio.volume = DEFAULT_VOLUME;
    this.audio.addEventListener('timeupdate', () => {
      this.setState({
        time: this.audio.currentTime,
      });
    });
    this.audio.addEventListener('ended', () => {
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

  setVolume(volume: number) {
    this.audio.volume = volume;
  }

  setTime(time: number) {
    this.audio.currentTime = time / 1000;
  }

  setSourceAndPlay() {
    this.setSource();
    this.play();
  }

  playPause() {
    if (this.state.playing) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    this.audio.play();
    this.setState({
      playing: true,
    });
  }

  pause() {
    this.audio.pause();
    this.setState({
      playing: false,
    });
  }

  setSource() {
    const track = this.state.playlist.getCurrentTrack();
    if (track) {
      this.audio.src = new URL(track.filePath).toString();
    }
  }

  onMaximize_() {
    this.setState({ mini: false });
  }

  onMinimize_() {
    this.setState({ mini: true });
  }

  nextTrack() {
    this.state.playlist.nextTrack();
    this.setSourceAndPlay();
  }

  nextAlbum() {
    this.state.playlist.nextAlbum();
    this.setSourceAndPlay();
  }

  prevAlbum() {
    this.state.playlist.prevAlbum();
    this.setSourceAndPlay();
  }

  prevTrack() {
    this.state.playlist.prevTrack();
    this.setSourceAndPlay();
  }

  setPlaylistAndPlay(playlist: EmptyPlaylist) {
    this.setState({playlist}, () => this.nextTrack());
  }

  render() {
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
          />
        </div>
      </div>
    );
  }
}

