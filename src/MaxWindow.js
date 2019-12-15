import AlbumPage from './AlbumPage';
import AlbumPicker from './AlbumPicker.js';
import ArtistPage from './ArtistPage';
import ArtistPicker from './ArtistPicker.js';
import EmptyPlaylist from './playlist/EmptyPlaylist';
import GenrePicker from './GenrePicker.js';
import Header from './Header.js';
import Library from './library/Library';
import PlaylistPage from './PlaylistPage.js';
import PlaylistPicker from './PlaylistPicker.js';
import PlaylistTypePicker from './PlaylistTypePicker.js';
import PropTypes from 'prop-types';
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
    ipcRenderer.on('toSong', this.onSongMessage.bind(this));
  }

  onSongMessage(evt, data) {
    this.goToSong(data.song);
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

  goToSong(song) {
    const scenes = this.state.scenes.slice(0, this.state.curScene + 1);
    scenes.push(
      () => <SongPicker
        genres={this.state.genres}
        library={this.props.library}
        playSong={this.props.playSong}
        scrollToSong={song}
        setPlaylistAndPlay={this.props.setPlaylistAndPlay}
        songs={this.props.library.getTracks(this.state.genres)}
      />
    );
    const curScene = this.state.curScene + 1;
    this.setState({scenes, curScene});
  }

  goToAlbum(album) {
    const scenes = this.state.scenes.slice(0, this.state.curScene + 1);
    scenes.push(
      () => <AlbumPage
        album={album}
        canGoForward={this.canGoForward()}
        goBack={this.goBack.bind(this)}
        goForward={this.goForward.bind(this)}
        goToArtist={this.goToArtist.bind(this)}
        library={this.props.library}
        setPlaylistAndPlay={this.props.setPlaylistAndPlay}
      />
    );
    const curScene = this.state.curScene + 1;
    this.setState({scenes, curScene});
  }

  goToArtist(artist) {
    const scenes = this.state.scenes.slice(0, this.state.curScene + 1);
    scenes.push(
      () => <ArtistPage
        artist={artist}
        canGoForward={this.canGoForward()}
        goBack={this.goBack.bind(this)}
        goForward={this.goForward.bind(this)}
        goToAlbum={this.goToAlbum.bind(this)}
        library={this.props.library}
        playSong={this.props.playSong}
        setPlaylistAndPlay={this.props.setPlaylistAndPlay}
      />

    );
    const curScene = this.state.curScene + 1;
    this.setState({scenes, curScene});
  }

  goToPlaylist(playlist) {
    const scenes = this.state.scenes.slice(0, this.state.curScene + 1);
    scenes.push(
      (genres) => <PlaylistPage
        canGoForward={this.canGoForward()}
        genres={genres}
        goBack={this.goBack.bind(this)}
        goForward={this.goForward.bind(this)}
        library={this.props.library}
        playlist={playlist}
        setPlaylistAndPlay={this.props.setPlaylistAndPlay}
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
          albums={this.props.library.getAlbums(this.state.genres)}
          goToAlbum={this.goToAlbum.bind(this)}
          library={this.props.library}
          setPlaylistAndPlay={this.props.setPlaylistAndPlay}
        />
      );
    case 'artist':
      return (
        <ArtistPicker
          artists={this.props.library.getArtists(this.state.genres)}
          goToArtist={this.goToArtist.bind(this)}
          library={this.props.library}
          playAlbum={this.props.playAlbum}
        />
      );
    case 'song':
      return (
        <SongPicker
          library={this.props.library}
          playSong={this.props.playSong}
          setPlaylistAndPlay={this.props.setPlaylistAndPlay}
          songs={this.props.library.getTracks(this.state.genres)}
        />
      );
    case 'playlist':
      return (
        <PlaylistPicker
          goToPlaylist={this.goToPlaylist.bind(this)}
          library={this.props.library}
          setPlaylistAndPlay={this.props.setPlaylistAndPlay}
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
          goToAlbum={this.goToAlbum.bind(this)}
          goToArtist={this.goToArtist.bind(this)}
          goToSong={this.goToSong.bind(this)}
          library={this.props.library}
          nextAlbum={this.props.nextAlbum}
          nextTrack={this.props.nextTrack}
          playing={this.props.playing}
          playlist={this.props.playlist}
          playPause={this.props.playPause}
          prevAlbum={this.props.prevAlbum}
          prevTrack={this.props.prevTrack}
          setTime={this.props.setTime}
          setVolume={this.props.setVolume}
          time={this.props.time}
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

MaxWindow.propTypes = {
  library: PropTypes.instanceOf(Library).isRequired,
  nextAlbum: PropTypes.func.isRequired,
  nextTrack: PropTypes.func.isRequired,
  playAlbum: PropTypes.func.isRequired,
  playPause: PropTypes.func.isRequired,
  playSong: PropTypes.func.isRequired,
  playing: PropTypes.bool.isRequired,
  playlist: PropTypes.instanceOf(EmptyPlaylist).isRequired,
  prevAlbum: PropTypes.func.isRequired,
  prevTrack: PropTypes.func.isRequired,
  setPlaylistAndPlay: PropTypes.func.isRequired,
  setTime: PropTypes.func.isRequired,
  setVolume: PropTypes.func.isRequired,
  time: PropTypes.number.isRequired,
};
