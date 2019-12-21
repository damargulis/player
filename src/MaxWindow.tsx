import Album from "./library/Album";
import AlbumPage from "./AlbumPage";
import AlbumPicker from "./AlbumPicker";
import Artist from "./library/Artist";
import ArtistPage from "./ArtistPage";
import ArtistPicker from "./ArtistPicker";
import {ipcRenderer} from "electron";
import EmptyPlaylist from "./playlist/EmptyPlaylist";
import GenrePicker from "./GenrePicker";
import Header from "./Header";
import Library from "./library/Library";
import Playlist from "./library/Playlist";
import PlaylistPage from "./PlaylistPage";
import PlaylistPicker from "./PlaylistPicker";
import PlaylistTypePicker from "./PlaylistTypePicker";
import React from "react";
import SongPicker from "./SongPicker";
import Track from "./library/Track";

interface MaxWindowProps {
  library: Library;
  playing: boolean;
  playlist: EmptyPlaylist;
  time: number;
  nextAlbum(): void;
  nextTrack(): void;
  playPause(): void;
  prevAlbum(): void;
  prevTrack(): void;
  setTime(time: number): void;
  setVolume(vol: number): void;
  setPlaylistAndPlay(playlist: EmptyPlaylist): void;
}

interface MaxWindowState {
  curScene: number;
  genres: number[];
  playlistType: string;
  scenes: Array<(genres: number[]) => JSX.Element>;
}

export default class MaxWindow extends React.Component<MaxWindowProps, MaxWindowState> {
  constructor(props: MaxWindowProps) {
    super(props);

    this.state = {
      curScene: -1,
      genres: [],
      playlistType: "album",
      scenes: [],
    };
    this.onArtistMessage = this.onArtistMessage.bind(this);
    this.onAlbumMessage = this.onAlbumMessage.bind(this);
    ipcRenderer.on("toArtist", this.onArtistMessage);
    ipcRenderer.on("toAlbum", this.onAlbumMessage);
    ipcRenderer.on("toSong", this.onSongMessage.bind(this));
  }

  public componentWillUnmount(): void {
    ipcRenderer.removeListener("toArtist", this.onArtistMessage);
  }

  public render(): JSX.Element {
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

  private onSongMessage(evt: Event, data: {song: Track}): void {
    this.goToSong(data.song);
  }

  private onAlbumMessage(evt: Event, data: {album: Album}): void {
    const album = this.props.library.getAlbumById(data.album.id);
    this.goToAlbum(album);
  }

  private onArtistMessage(evt: Event, data: {artist: Artist}): void {
    const artist = this.props.library.getArtistById(data.artist.id);
    this.goToArtist(artist);
  }

  private setGenres(genres: number[]): void {
    this.setState({
      genres,
    });
  }

  private setType(type: string): void {
    this.setState({
      curScene: -1,
      playlistType: type,
      scenes: [],
    });
  }

  private goBack(): void {
    this.setState({
      curScene: this.state.curScene - 1,
    });
  }

  private goForward(): void {
    this.setState({
      curScene: this.state.curScene + 1,
    });
  }

  private canGoForward(): boolean {
    return this.state.curScene < this.state.scenes.length - 1;
  }

  private goToSong(song: Track): void {
    const scenes = this.state.scenes.slice(0, this.state.curScene + 1);
    scenes.push(
      () => <SongPicker
        library={this.props.library}
        scrollToSong={song}
        setPlaylistAndPlay={this.props.setPlaylistAndPlay}
        songs={this.props.library.getTracks(this.state.genres)}
      />,
    );
    const curScene = this.state.curScene + 1;
    this.setState({scenes, curScene});
  }

  private goToAlbum(album: Album): void {
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
      />,
    );
    const curScene = this.state.curScene + 1;
    this.setState({scenes, curScene});
  }

  private goToArtist(artist: Artist): void {
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
      />,

    );
    const curScene = this.state.curScene + 1;
    this.setState({scenes, curScene});
  }

  private goToPlaylist(playlist: Playlist): void {
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
      />,

    );
    const curScene = this.state.curScene + 1;
    this.setState({scenes, curScene});
  }

  private getPicker(): JSX.Element | undefined {
    if (this.state.curScene >= 0) {
      return this.state.scenes[this.state.curScene](this.state.genres);
    }
    switch (this.state.playlistType) {
    case "album":
      return (
        <AlbumPicker
          albums={this.props.library.getAlbums(this.state.genres)}
          goToAlbum={this.goToAlbum.bind(this)}
          library={this.props.library}
          setPlaylistAndPlay={this.props.setPlaylistAndPlay}
        />
      );
    case "artist":
      return (
        <ArtistPicker
          artists={this.props.library.getArtists(this.state.genres)}
          goToArtist={this.goToArtist.bind(this)}
          library={this.props.library}
        />
      );
    case "song":
      return (
        <SongPicker
          library={this.props.library}
          setPlaylistAndPlay={this.props.setPlaylistAndPlay}
          songs={this.props.library.getTracks(this.state.genres)}
        />
      );
    case "playlist":
      return (
        <PlaylistPicker
          goToPlaylist={this.goToPlaylist.bind(this)}
          library={this.props.library}
          setPlaylistAndPlay={this.props.setPlaylistAndPlay}
        />
      );
    default:
      return;
    }
  }
}
