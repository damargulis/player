import React from 'react';
import Header from './Header.js';
import PlaylistTypePicker from './PlaylistTypePicker.js';
import AlbumPicker from './AlbumPicker.js';
import GenrePicker from './GenrePicker.js';
import ArtistPicker from './ArtistPicker.js';
import SongPicker  from './SongPicker.js';
import PlaylistPicker from './PlaylistPicker.js';

export class MaxWindow extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      genres: [],
      playlistType: 'album',
    }
  }

  setGenres(genres) {
    this.setState({
      genres
    });
  }

  setType(type) {
    this.setState({
      playlistType: type,
    });
  }

  getPicker() {
    switch (this.state.playlistType) {
      case 'album':
        return (
          <AlbumPicker
            playAlbum={this.props.playAlbum}
            albums={this.props.library.getAlbums(this.state.genres)}
            library={this.props.library}
          />
        )
      case 'artist':
        return (
          <ArtistPicker
            playAlbum={this.props.playAlbum}
            artists={this.props.library.getArtists(this.state.genres)}
            library={this.props.library}
          />
        )
      case 'song':
        return (
          <SongPicker
            playSong={this.props.playSong}
            library={this.props.library}
            songs={this.props.library.getTracks(this.state.genres)}
          />
        )
      case 'playlist':
        return (
          <PlaylistPicker library={this.props.library} />
        )
      default:
        return null;
    }
  }

  render() {
    return (
      <div id="max-window" >
        <Header
          setTime={this.props.setTime}
          playing={this.props.playing}
          playPause={this.props.playPause}
          nextTrack={this.props.nextTrack}
          nextAlbum={this.props.nextAlbum}
          prevTrack={this.props.prevTrack}
          prevAlbum={this.props.prevAlbum}
          playlist={this.props.playlist}
          library={this.props.library}
          setVolume={this.props.setVolume}
          time={this.props.time}
        />
        <div className="section">
          <div id="sidebar">
            <PlaylistTypePicker 
              setType={this.setType.bind(this)}
            />
            <GenrePicker
              library={this.props.library}
              setGenres={this.setGenres.bind(this)}
            />
          </div>
          {
            this.getPicker()
          }
        </div>
      </div>
    )
  }
}

