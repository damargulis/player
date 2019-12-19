import Album from './library/Album';
import Artist from './library/Artist';
import AlbumPage from './AlbumPage';
import AlbumPicker from './AlbumPicker';
import ArtistPage from './ArtistPage';
import ArtistPicker from './ArtistPicker';
import EmptyPlaylist from './playlist/EmptyPlaylist';
import GenrePicker from './GenrePicker';
import Header from './Header';
import Library from './library/Library';
import Playlist from './library/Playlist';
import PlaylistPage from './PlaylistPage';
import PlaylistPicker from './PlaylistPicker';
import PlaylistTypePicker from './PlaylistTypePicker';
import React from 'react';
import SongPicker from './SongPicker';
import Track from './library/Track';
const {ipcRenderer} = require('electron');

interface MaxWindowProps {
  library: Library;
  nextAlbum: () => void;
  nextTrack: () => void;
  playing: boolean;
  playlist: EmptyPlaylist;
  playPause: () => void;
  prevAlbum: () => void;
  prevTrack: () => void;
  setTime: (time: number) => void;
  setVolume: (vol: number) => void;
  time: number;
  setPlaylistAndPlay: (playlist: EmptyPlaylist) => void;
}

interface MaxWindowState {
  curScene: number;
  genres: number[];
  playlistType: string;
  scenes: ((genres: number[]) => JSX.Element)[];
}

export default class MaxWindow extends React.Component<MaxWindowProps,MaxWindowState> {
  constructor(props: MaxWindowProps) {
    super(props);

    this.state = {
      genres: [],
      playlistType: 'album',
      scenes: [],
      curScene: -1,
    };
    this.onArtistMessage = this.onArtistMessage.bind(this);
    this.onAlbumMessage = this.onAlbumMessage.bind(this);
    ipcRenderer.on('toArtist', this.onArtistMessage);
    ipcRenderer.on('toAlbum', this.onAlbumMessage);
    ipcRenderer.on('toSong', this.onSongMessage.bind(this));
  }

  onSongMessage(evt: Event, data: {song: Track}) {
    this.goToSong(data.song);
  }

  onAlbumMessage(evt: Event, data: {album: Album}) {
    const album = this.props.library.getAlbumById(data.album.id);
    this.goToAlbum(album);
  }

  onArtistMessage(evt: Event, data: {artist: Artist}) {
    const artist = this.props.library.getArtistById(data.artist.id);
    this.goToArtist(artist);
  }

  componentWillUnmount() {
    ipcRenderer.removeListener('toArtist', this.onArtistMessage);
  }

  setGenres(genres: number[]) {
    this.setState({
      genres
    });
  }

  setType(type: string) {
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

  goToSong(song: Track) {
    const scenes = this.state.scenes.slice(0, this.state.curScene + 1);
    scenes.push(
      () => <SongPicker
        library={this.props.library}
        scrollToSong={song}
        setPlaylistAndPlay={this.props.setPlaylistAndPlay}
        songs={this.props.library.getTracks(this.state.genres)}
      />
    );
    const curScene = this.state.curScene + 1;
    this.setState({scenes, curScene});
  }

  goToAlbum(album: Album) {
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

  goToArtist(artist: Artist) {
    const scenes = this.state.scenes.slice(0, this.state.curScene + 1);
    scenes.push(
      () => <ArtistPage
        artist={artist}
        canGoForward={this.canGoForward()}
        goBack={this.goBack.bind(this)}
        goForward={this.goForward.bind(this)}
        goToAlbum={this.goToAlbum.bind(this)}
        library={this.props.library}
        setPlaylistAndPlay={this.props.setPlaylistAndPlay}
      />

    );
    const curScene = this.state.curScene + 1;
    this.setState({scenes, curScene});
  }

  goToPlaylist(playlist: Playlist) {
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
        />
      );
    case 'song':
      return (
        <SongPicker
          library={this.props.library}
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
