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
          goToAlbum={this.goToAlbum.bind(this)}
          goToArtist={this.goToArtist.bind(this)}
          goToTrack={this.goToTrack.bind(this)}
          small={true}
        />
        <div style={{height: '25px', display: 'flex'}}>
          <ControlPanel volumeButton={true} />
        </div>
        <ProgressBar />
      </div>
    );
  }

  private goToTrack(trackId: number): void {
    ipcRenderer.send('goToTrack', {trackId});
  }

  private goToArtist(artistId: number): void {
    ipcRenderer.send('goToArtist', {artistId});
  }

  private goToAlbum(albumId: number): void {
    ipcRenderer.send('goToAlbum', {albumId});
  }
}

export default MiniWindow;
