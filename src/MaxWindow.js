import AlbumPage from './AlbumPage';
import AlbumPicker from './AlbumPicker.js';
import ArtistPage from './ArtistPage';
import ArtistPicker from './ArtistPicker.js';
import GenrePicker from './GenrePicker.js';
import Header from './Header.js';
import PlaylistPage from './PlaylistPage.js';
import PlaylistPicker from './PlaylistPicker.js';
import PlaylistTypePicker from './PlaylistTypePicker.js';
import React from 'react';
import SongPicker  from './SongPicker.js';
const {ipcRenderer} = require('electron');

export default class MaxWindow extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      genres: [],
      playlistType: 'album',
      scenes: [],
    }

    ipcRenderer.on('toAlbum', (evt, data) => {
      setTimeout(() => {
        this.goToAlbum(data.album);
      });
    });
    this.onArtistMessage = this.onArtistMessage.bind(this);
    ipcRenderer.on('toArtist', this.onArtistMessage);
  }

  onArtistMessage(evt, data) {
    this.goToArtist(data.artist);
  }

  componentWillUnmount() {
    ipcRenderer.removeListener('toArtist', this.onArtistMessage);
  }

  setGenres(genres) {
    this.setState({
      genres
    });
  }

  setType(type) {
    this.setState({
      playlistType: type,
      scenes: [],
    });
  }

  goBack() {
    const scenes = this.state.scenes;
    scenes.pop();
    this.setState({
      scenes,
    });
  }

  goToAlbum(album) {
    const scenes = this.state.scenes;
    scenes.push(
      (genres) => (
      <AlbumPage
        setPlaylistAndPlay={this.props.setPlaylistAndPlay}
        library={this.props.library}
        album={album}
        goBack={this.goBack.bind(this)}
        goToArtist={this.goToArtist.bind(this)}
      />
      )
    );
    this.setState({scenes});
  }

  goToArtist(artist) {
    const scenes = this.state.scenes;
    scenes.push(
      (genres) => (
      <ArtistPage
        setPlaylistAndPlay={this.props.setPlaylistAndPlay}
        library={this.props.library}
        artist={artist}
        goBack={this.goBack.bind(this)}
        goToAlbum={this.goToAlbum.bind(this)}
        playSong={this.props.playSong}
      />
      )
    );
    this.setState({scenes});
  }

  goToPlaylist(playlist) {
    const scenes = this.state.scenes;
    scenes.push(
      (genres) => (
      <PlaylistPage
        setPlaylistAndPlay={this.props.setPlaylistAndPlay}
        library={this.props.library}
        playlist={playlist}
        goBack={this.goBack.bind(this)}
        genres={genres}
      />
      )
    );
    this.setState({scenes});
  }

  getPicker() {
    if (this.state.scenes.length) {
      return this.state.scenes[this.state.scenes.length - 1](this.state.genres);
    }
    switch (this.state.playlistType) {
    case 'album':
      return (
        <AlbumPicker
          setPlaylistAndPlay={this.props.setPlaylistAndPlay}
          albums={this.props.library.getAlbums(this.state.genres)}
          library={this.props.library}
          goToAlbum={this.goToAlbum.bind(this)}
        />
      )
    case 'artist':
      return (
        <ArtistPicker
          playAlbum={this.props.playAlbum}
          artists={this.props.library.getArtists(this.state.genres)}
          library={this.props.library}
          goToArtist={this.goToArtist.bind(this)}
        />
      )
    case 'song':
      return (
        <SongPicker
          playSong={this.props.playSong}
          setPlaylistAndPlay={this.props.setPlaylistAndPlay}
          library={this.props.library}
          songs={this.props.library.getTracks(this.state.genres)}
        />
      )
    case 'playlist':
      return (
        <PlaylistPicker
          setPlaylistAndPlay={this.props.setPlaylistAndPlay}
          library={this.props.library}
          goToPlaylist={this.goToPlaylist.bind(this)}
        />
      )
    default:
      return null;
    }
  }

  render() {
    return (
      <div id="max-window" >
        <Header
          setTime={this.props.setTime}
          playing={this.props.playing}
          playPause={this.props.playPause}
          nextTrack={this.props.nextTrack}
          nextAlbum={this.props.nextAlbum}
          prevTrack={this.props.prevTrack}
          prevAlbum={this.props.prevAlbum}
          playlist={this.props.playlist}
          library={this.props.library}
          setVolume={this.props.setVolume}
          time={this.props.time}
          goToArtist={this.goToArtist.bind(this)}
          goToAlbum={this.goToAlbum.bind(this)}
        />
        <div className="section">
          <div id="sidebar">
            <PlaylistTypePicker 
              setType={this.setType.bind(this)}
            />
            <GenrePicker
              library={this.props.library}
              setGenres={this.setGenres.bind(this)}
            />
          </div>
          {
            this.getPicker()
          }
        </div>
      </div>
    )
  }
}

