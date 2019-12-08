import EmptyPlaylist from './playlist/EmptyPlaylist';
import Library from './library/Library';
import MaxWindow from './MaxWindow';
import MiniWindow from './MiniWindow';
import RandomAlbumPlaylist from './playlist/RandomAlbumPlaylist';
import RandomSongPlaylist from './playlist/RandomSongPlaylist';
import React from 'react';
import runWikiExtension from './extensions/wiki/main';
import {
  createLibraryFromItunes,
  deleteLibrary,
  loadLibrary
} from './library/create_library';

import './App.css';

const {ipcRenderer} = require('electron');

const DEFAULT_VOLUME = .1;

export default class App extends React.Component {
  constructor(props) {
    super(props);
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
    ipcRenderer.on('run-extension', (type, arg) => {
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
        createLibraryFromItunes().then((library) => {
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

    loadLibrary('data/library.json').then((library) => {
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
      this.state.playlist.getCurrentTrack().playCount++;
      this.nextTrack();
    });
  }

  setVolume(volume) {
    this.audio.volume = volume;
  }

  setTime(time) {
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
      this.audio.src = new URL(track.filePath);
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

  playAlbum(album) {
    const playlist = new RandomAlbumPlaylist(this.state.library);
    playlist.addAlbum(album);
    this.setState({
      playlist,
    }, () => {
      this.nextAlbum();
    });
  }

  playSong(song) {
    const playlist = new RandomSongPlaylist(this.state.library);
    playlist.addSong(song);
    this.setState({
      playlist,
    }, () => {
      this.nextTrack();
    });
  }

  setPlaylistAndPlay(playlist) {
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
            playlist={this.state.playlist}
            library={this.state.library}
            nextTrack={this.nextTrack.bind(this)}
            nextAlbum={this.nextAlbum.bind(this)}
            prevTrack={this.prevTrack.bind(this)}
            prevAlbum={this.prevAlbum.bind(this)}
            playAlbum={this.playAlbum.bind(this)}
            playSong={this.playSong.bind(this)}
            playPause={this.playPause.bind(this)}
            playing={this.state.playing}
            setVolume={this.setVolume.bind(this)}
            setTime={this.setTime.bind(this)}
            time={this.state.time}
          />
        </div>
        <div style={{display: mini ? "none" : "initial"}}>
          <MaxWindow
            setPlaylistAndPlay={this.setPlaylistAndPlay.bind(this)}
            playlist={this.state.playlist}
            library={this.state.library}
            nextTrack={this.nextTrack.bind(this)}
            nextAlbum={this.nextAlbum.bind(this)}
            prevTrack={this.prevTrack.bind(this)}
            prevAlbum={this.prevAlbum.bind(this)}
            playAlbum={this.playAlbum.bind(this)}
            playSong={this.playSong.bind(this)}
            playPause={this.playPause.bind(this)}
            playing={this.state.playing}
            setVolume={this.setVolume.bind(this)}
            setTime={this.setTime.bind(this)}
            time={this.state.time}
          />
        </div>
      </div>
    );
  }
}

