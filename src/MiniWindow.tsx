import Album from "./library/Album";
import Artist from "./library/Artist";
import ControlPanel from "./ControlPanel";
import {ipcRenderer} from "electron";
import EmptyPlaylist from "./playlist/EmptyPlaylist";
import InfoPanel from "./InfoPanel";
import Library from "./library/Library";
import ProgressBar from "./ProgressBar";
import React from "react";
import Track from "./library/Track";

interface MiniWindowProps {
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
}

export default class MiniWindow extends React.Component<MiniWindowProps> {

  public render(): JSX.Element {
    return (
      <div id="mini-window">
        <InfoPanel
          goToAlbum={this.goToAlbum.bind(this)}
          goToArtist={this.goToArtist.bind(this)}
          goToSong={this.goToSong.bind(this)}
          library={this.props.library}
          small={true}
          track={this.props.playlist.getCurrentTrack()}
        />
        <div style={{height: "25px", display: "flex"}}>
          <ControlPanel
            library={this.props.library}
            nextAlbum={this.props.nextAlbum}
            nextTrack={this.props.nextTrack}
            playing={this.props.playing}
            playlist={this.props.playlist}
            playPause={this.props.playPause}
            prevAlbum={this.props.prevAlbum}
            prevTrack={this.props.prevTrack}
            setVolume={this.props.setVolume}
            volumeButton={true}
          />
        </div>
        <ProgressBar
          setTime={this.props.setTime}
          time={this.props.time}
          track={this.props.playlist.getCurrentTrack()}
        />
      </div>
    );
  }
  private goToSong(song: Track): void {
    ipcRenderer.send("goToSong", {song});
  }

  private goToArtist(artist: Artist): void {
    ipcRenderer.send("goToArtist", {artist});
  }

  private goToAlbum(album: Album): void {
    ipcRenderer.send("goToAlbum", {album});
  }
}
