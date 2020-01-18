import Album from "./library/Album";
import Artist from "./library/Artist";
import ControlPanel from "./ControlPanel";
import { ipcRenderer } from "electron";
import InfoPanel from "./InfoPanel";
import ProgressBar from "./ProgressBar";
import React from "react";
import Track from "./library/Track";

interface MiniWindowProps {
  setTime(time: number): void;
}

// TODO: set all css by doing .mini-window .innerClass {}
class MiniWindow extends React.Component<MiniWindowProps> {

  public render(): JSX.Element {
    return (
      <div id="mini-window">
        <InfoPanel
          goToAlbum={ this.goToAlbum.bind(this)}
          goToArtist={ this.goToArtist.bind(this)}
          goToSong={ this.goToSong.bind(this)}
          small={ true}
        />
        <div style={ { height: "25px", display: "flex"}}>
          <ControlPanel
            volumeButton={ true}
          />
        </div>
        <ProgressBar
          setTime={ this.props.setTime}
        />
      </div>
    );
  }
  private goToSong(song: Track): void {
    ipcRenderer.send("goToSong", { song});
  }

  private goToArtist(artist: Artist): void {
    ipcRenderer.send("goToArtist", { artist});
  }

  private goToAlbum(album: Album): void {
    ipcRenderer.send("goToAlbum", { album});
  }
}

export default MiniWindow;
