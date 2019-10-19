import React from 'react';
//import logo from './logo.svg';
import './App.css';

import {MaxWindow} from './MaxWindow';
import {MiniWindow} from './MiniWindow';

import {createLibrary}  from './library/create_library';
import Library from './library/Library';
import EmptyPlaylist from './playlist/EmptyPlaylist';
import RandomAlbumPlaylist from './playlist/RandomAlbumPlaylist';

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
    };
    ipcRenderer.on('minimize-reply', () => {
      this.onMinimize_();
    });
    createLibrary().then((library) => {
      const playlist = new RandomAlbumPlaylist(library);
      this.setState({
        library: library,
        playlist: playlist
      });
    })

    this.audio = new Audio();
    this.audio.volume = DEFAULT_VOLUME;
  }

  setVolume(volume) {
    this.audio.volume = volume;
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

  onMinimize_() {
    this.setState({ mini: true, });
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
    this.state.playlist.addAlbum(album);
    this.nextAlbum();
  }

  render() {
    const mini = this.state.mini;
    return mini ? <MiniWindow/> : <MaxWindow
      playlist={this.state.playlist}
      library={this.state.library}
      nextTrack={this.nextTrack.bind(this)}
      nextAlbum={this.nextAlbum.bind(this)}
      prevTrack={this.prevTrack.bind(this)}
      prevAlbum={this.prevAlbum.bind(this)}
      playAlbum={this.playAlbum.bind(this)}
      playPause={this.playPause.bind(this)}
      playing={this.state.playing}
      setVolume={this.setVolume.bind(this)}
      />;
  }

}

