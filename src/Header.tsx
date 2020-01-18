import Album from "./library/Album";
import Artist from "./library/Artist";
import ControlPanel from "./ControlPanel";
import InfoPanel from "./InfoPanel";
import ProgressBar from "./ProgressBar";
import React from "react";
import Track from "./library/Track";

interface HeaderProps {
  goToAlbum(album: Album): void;
  goToArtist(artist: Artist): void;
  goToSong(track: Track): void;
  setTime(time: number): void;
}

export default class Header extends React.Component<HeaderProps> {
  public render(): JSX.Element {
    return (
      <div id="header" style={{padding: "2px"}}>
        <ControlPanel />
        <ProgressBar
          setTime={this.props.setTime}
        />
        <InfoPanel
          goToAlbum={this.props.goToAlbum}
          goToArtist={this.props.goToArtist}
          goToSong={this.props.goToSong}
        />
      </div>
    );
  }
}
