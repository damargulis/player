import ControlPanel from './ControlPanel';
import InfoPanel from './InfoPanel';
import ProgressBar from './ProgressBar';
import React from 'react';

interface HeaderProps {
  goToAlbum(albumId: number): void;
  goToArtist(artistId: number): void;
  goToSong(trackId: number): void;
}

export default class Header extends React.Component<HeaderProps> {
  public render(): JSX.Element {
    return (
      <div id="header" style={{padding: '2px'}}>
        <ControlPanel />
        <ProgressBar />
        <InfoPanel
          goToAlbum={this.props.goToAlbum}
          goToArtist={this.props.goToArtist}
          goToSong={this.props.goToSong}
        />
      </div>
    );
  }
}
