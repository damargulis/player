import Artist from './library/Artist';
import Album from './library/Album';
import ControlPanel from './ControlPanel';
import EmptyPlaylist from './playlist/EmptyPlaylist';
import InfoPanel from './InfoPanel';
import Library from './library/Library';
import ProgressBar from './ProgressBar';
import React from 'react';
import Track from './library/Track';

const {ipcRenderer} = require('electron');

interface MiniWindowProps {
  library: Library;
  nextAlbum: () => void;
  nextTrack: () => void;
  playing: boolean;
  playlist: EmptyPlaylist;
  playPause: () => void;
  prevAlbum: () => void;
  prevTrack: () => void;
  setTime: (time: number) => void;
  setVolume: (vol: number) => void;
  time: number;
}

export default class MiniWindow extends React.Component<MiniWindowProps,{}> {
  goToSong(song: Track) {
    ipcRenderer.send('goToSong', {song});
  }

  goToArtist(artist: Artist) {
    ipcRenderer.send('goToArtist', {artist});
  }

  goToAlbum(album: Album) {
    ipcRenderer.send('goToAlbum', {album});
  }

  render() {
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
}
