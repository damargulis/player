import React from 'react';
import SongPicker  from './SongPicker.js';
import modifyAlbum from './extensions/wiki/albums';

const path = require('path');

export default class AlbumPicker extends React.Component {
  runWiki() {
    modifyAlbum(this.props.album, this.props.library).then(() => {
      console.log('modified, saving');
      this.props.library.save();
    });
  }

  getErrors() {
    if (!this.props.album.errors.length) {
      return null;
    }
    return (
      <div style={{
        border: "solid red 1px",
        marginTop: "10px",
        marginBottom: "10px",
        marginLeft: "100px",
      }}
      >
        <div> Errors: </div>
        {
          this.props.album.errors.map((error, index) => {
            return (
              <div key={index}>{error}</div>
            )
          })
        }
      </div>

    );
  }

  getArtistLinks() {
    if (!this.props.album) {
      return null;
    }
    const artists = this.props.library.getArtistsByIds(
      this.props.album.artistIds);
    return artists.map((artist, index) => {
      return (
        <div key={index}>
          <div className="link" onClick={() => this.props.goToArtist(artist)}>
            {artist.name}
          </div>
        </div>
      )
    });
  }

  render() {
    // todo use albumInfo or combine logic
    // ya know actually separate conscers and shit
    const file = this.props.album && this.props.album.albumArtFile;
    const src = file ? new URL('file://' + path.resolve(file)) : null;
    //const artist = this.props.library.getArtistsByIds(
    //  this.props.album.artistIds).map((artist) => {
    //  return artist.name;
    //}).join(", ");
    // todo: set playSong to play an album playlist of by artist ?
    return (
      <div className="main">
        <div className="albumPageHeader" style={{display: "flex"}}>
          <div className="info">
            <img src={src} alt="album art" width="100" height="100" />
            <div>{this.props.album && this.props.album.name}</div>
            {this.getArtistLinks()}
            <button onClick={this.props.goBack}>Back</button>
            <button onClick={this.runWiki.bind(this)}>Run Wiki Extension</button>
          </div>
          {
            this.getErrors() 
          }
        </div>
        <SongPicker
          setPlaylistAndPlay={this.props.setPlaylistAndPlay}
          songs={this.props.library.getAlbumTracks(this.props.album)}
          library={this.props.library}
        />
          
      </div>
    )
  }
}
