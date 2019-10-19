import React from 'react';
import Header from './Header.js';
import PlaylistTypePicker from './PlaylistTypePicker.js';
import AlbumPicker from './AlbumPicker.js';
import GenrePicker from './GenrePicker.js';

export class MaxWindow extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      genres: [],
    }
  }

  setGenres(genres) {
    this.setState({
      genres
    });
  }

  render() {
    return (
      <div id="max-window" >
        <Header
          playing={this.props.playing}
          playPause={this.props.playPause}
          nextTrack={this.props.nextTrack}
          nextAlbum={this.props.nextAlbum}
          prevTrack={this.props.prevTrack}
          prevAlbum={this.props.prevAlbum}
          playlist={this.props.playlist}
          library={this.props.library}
          setVolume={this.props.setVolume}
        />
        <div className="section">
          <div id="sidebar">
            <PlaylistTypePicker />
            <GenrePicker
              library={this.props.library}
              setGenres={this.setGenres.bind(this)}
            />
          </div>
          <AlbumPicker
            playAlbum={this.props.playAlbum}
            albums={this.props.library.getAlbums(this.state.genres)}
            library={this.props.library}
          />
        </div>
      </div>
    )
  }
}

