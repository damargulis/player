import Album from "./library/Album";
import Artist from "./library/Artist";
import ControlPanel from "./ControlPanel";
import EmptyPlaylist from "./playlist/EmptyPlaylist";
import InfoPanel from "./InfoPanel";
import Library from "./library/Library";
import ProgressBar from "./ProgressBar";
import React from "react";
import Track from "./library/Track";

interface HeaderProps {
  volume: number;
  playlist: EmptyPlaylist;
  library: Library;
  playing: boolean;
  time: number;
  nextAlbum(): void;
  nextTrack(): void;
  playPause(): void;
  prevAlbum(): void;
  prevTrack(): void;
  setVolume(vol: number): void;
  goToAlbum(album: Album): void;
  goToArtist(artist: Artist): void;
  goToSong(track: Track): void;
  setTime(time: number): void;
}

export default class Header extends React.Component<HeaderProps> {
  public render(): JSX.Element {
    const track = this.props.playlist.getCurrentTrack();
    return (
      <div id="header" style={{padding: "2px"}}>
        <ControlPanel
          volume={this.props.volume}
          library={this.props.library}
          nextAlbum={this.props.nextAlbum}
          nextTrack={this.props.nextTrack}
          playing={this.props.playing}
          playlist={this.props.playlist}
          playPause={this.props.playPause}
          prevAlbum={this.props.prevAlbum}
          prevTrack={this.props.prevTrack}
          setVolume={this.props.setVolume}
        />
        <ProgressBar
          setTime={this.props.setTime}
          track={track}
        />
        <InfoPanel
          goToAlbum={this.props.goToAlbum}
          goToArtist={this.props.goToArtist}
          goToSong={this.props.goToSong}
          library={this.props.library}
          track={track}
        />
      </div>
    );
  }
}
