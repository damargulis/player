import ControlPanel from './ControlPanel';
import {ipcRenderer} from 'electron';
import InfoPanel from './InfoPanel';
import ProgressBar from './ProgressBar';
import React from 'react';

// TODO: set all css by doing .mini-window .innerClass {}
class MiniWindow extends React.Component {

  public render(): JSX.Element {
    return (
      <div id="mini-window">
        <InfoPanel
          goToAlbum={(albumId) => this.goToAlbum(albumId)}
          goToArtist={(artistId) => this.goToArtist(artistId)}
          goToTrack={(trackId) => this.goToTrack(trackId)}
          small={true}
        />
        <div style={{height: '25px', display: 'flex'}}>
          <ControlPanel volumeButton={true} />
        </div>
        <ProgressBar />
      </div>
    );
  }

  private goToTrack(trackId: string): void {
    ipcRenderer.send('goToTrack', {trackId});
  }

  private goToArtist(artistId: string): void {
    ipcRenderer.send('goToArtist', {artistId});
  }

  private goToAlbum(albumId: string): void {
    ipcRenderer.send('goToAlbum', {albumId});
  }
}

export default MiniWindow;
