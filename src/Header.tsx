import ControlPanel from './ControlPanel';
import InfoPanel from './InfoPanel';
import ProgressBar from './ProgressBar';
import React from 'react';

interface HeaderProps {
  goToAlbum(albumId: string): void;
  goToArtist(artistId: string): void;
  goToTrack(trackId: string): void;
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
          goToTrack={this.props.goToTrack}
        />
      </div>
    );
  }
}
