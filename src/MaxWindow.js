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
import SongPicker from './SongPicker.js';
const {ipcRenderer} = require('electron');

export default class MaxWindow extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      genres: [],
      playlistType: 'album',
      scenes: [],
      curScene: -1,
    };

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
      curScene: -1,
    });
  }

  goBack() {
    this.setState({
      curScene: this.state.curScene - 1,
    });
  }

  goForward() {
    this.setState({
      curScene: this.state.curScene + 1,
    });
  }

  canGoForward() {
    return this.state.curScene < this.state.scenes.length - 1;
  }

  goToAlbum(album) {
    const scenes = this.state.scenes.slice(0, this.state.curScene + 1);
    scenes.push(
      () => <AlbumPage
        setPlaylistAndPlay={this.props.setPlaylistAndPlay}
        library={this.props.library}
        album={album}
        goBack={this.goBack.bind(this)}
        goForward={this.goForward.bind(this)}
        canGoForward={this.canGoForward()}
        goToArtist={this.goToArtist.bind(this)}
      />
    );
    const curScene = this.state.curScene + 1;
    this.setState({scenes, curScene});
  }

  goToArtist(artist) {
    const scenes = this.state.scenes.slice(0, this.state.curScene + 1);
    scenes.push(
      () => <ArtistPage
        setPlaylistAndPlay={this.props.setPlaylistAndPlay}
        library={this.props.library}
        artist={artist}
        goBack={this.goBack.bind(this)}
        goForward={this.goForward.bind(this)}
        canGoForward={this.canGoForward()}
        goToAlbum={this.goToAlbum.bind(this)}
        playSong={this.props.playSong}
      />

    );
    const curScene = this.state.curScene + 1;
    this.setState({scenes, curScene});
  }

  goToPlaylist(playlist) {
    const scenes = this.state.scenes.slice(this.state.curScene + 1);
    scenes.push(
      (genres) => <PlaylistPage
        setPlaylistAndPlay={this.props.setPlaylistAndPlay}
        library={this.props.library}
        playlist={playlist}
        goBack={this.goBack.bind(this)}
        goForward={this.goForward.bind(this)}
        canGoForward={this.canGoForward()}
        genres={genres}
      />

    );
    const curScene = this.state.curScene + 1;
    this.setState({scenes, curScene});
  }

  getPicker() {
    if (this.state.curScene >= 0) {
      return this.state.scenes[this.state.curScene](this.state.genres);
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
      );
    case 'artist':
      return (
        <ArtistPicker
          playAlbum={this.props.playAlbum}
          artists={this.props.library.getArtists(this.state.genres)}
          library={this.props.library}
          goToArtist={this.goToArtist.bind(this)}
        />
      );
    case 'song':
      return (
        <SongPicker
          genres={this.state.genres}
          playSong={this.props.playSong}
          setPlaylistAndPlay={this.props.setPlaylistAndPlay}
          library={this.props.library}
          songs={this.props.library.getTracks(this.state.genres)}
        />
      );
    case 'playlist':
      return (
        <PlaylistPicker
          setPlaylistAndPlay={this.props.setPlaylistAndPlay}
          library={this.props.library}
          goToPlaylist={this.goToPlaylist.bind(this)}
        />
      );
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
    );
  }
}

