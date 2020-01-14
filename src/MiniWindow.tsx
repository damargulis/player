import Album from "./library/Album";
import Artist from "./library/Artist";
import ControlPanel from "./ControlPanel";
import {ipcRenderer} from "electron";
import EmptyPlaylist from "./playlist/EmptyPlaylist";
import InfoPanel from "./InfoPanel";
import ProgressBar from "./ProgressBar";
import React from "react";
import Track from "./library/Track";

interface MiniWindowProps {
  playing: boolean;
  playlist: EmptyPlaylist;
  volume: number;
  nextAlbum(): void;
  nextTrack(): void;
  playPause(): void;
  prevAlbum(): void;
  prevTrack(): void;
  setTime(time: number): void;
  setVolume(vol: number): void;
}

// TODO: set all css by doing .mini-window .innerClass {}
class MiniWindow extends React.Component<MiniWindowProps> {

  public render(): JSX.Element {
    return (
      <div id="mini-window">
        <InfoPanel
          goToAlbum={this.goToAlbum.bind(this)}
          goToArtist={this.goToArtist.bind(this)}
          goToSong={this.goToSong.bind(this)}
          small={true}
          track={this.props.playlist.getCurrentTrack()}
        />
        <div style={{height: "25px", display: "flex"}}>
          <ControlPanel
            nextAlbum={this.props.nextAlbum}
            nextTrack={this.props.nextTrack}
            playing={this.props.playing}
            playlist={this.props.playlist}
            playPause={this.props.playPause}
            prevAlbum={this.props.prevAlbum}
            prevTrack={this.props.prevTrack}
            setVolume={this.props.setVolume}
            volumeButton={true}
            volume={this.props.volume}
          />
        </div>
        <ProgressBar
          setTime={this.props.setTime}
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

export default MiniWindow;
