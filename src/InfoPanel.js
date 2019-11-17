import React from 'react';

const {ipcRenderer} = require('electron');
const path = require('path');

export default class InfoPanel extends React.Component {
  onImageClick_() {
    if (this.props.small) {
      ipcRenderer.send('maximize');
    } else {
      ipcRenderer.send('minimize');
    }
  }

  getArtistLinks() {
    const {track, library} = this.props;
    const artists = track && library
      ? library.getArtistsByIds(track.artistIds) : [];
    if (artists.length) {
      return artists.map((artist, index) => {
        return (
          <div key={index}>
            <div className="link" onClick={() => this.props.goToArtist(artist)}>
              {artist.name}
            </div>
          </div>
        );
      });
    }
    return "Artists";
  }

  getAlbumLinks() {
    const {track, library} = this.props;
    const albums = track && library
      ? library.getAlbumsByIds(track.albumIds) : [];
    return albums.map((album, index) => {
      return (
        <div key={index}>
          <div className="link" onClick={() => this.props.goToAlbum(album)}>
            {album.name}
          </div>
        </div>
      );
    });
  }

  render() {
    const {track, library} = this.props;
    const albums = track && library
      ? library.getAlbumsByIds(track.albumIds) : [];
    const album = albums[0];
    const imageSrc = album && album.albumArtFile
      ? new URL('file://' + path.resolve(album.albumArtFile)) : null;
    const src = imageSrc;
    // TODO: make rotate instead -- conditionally on playlist type??
    // meaning like if its playing a specific album, only show that album
    // (and artwork)
    // if on song shuffle, then rotate between all.
    const imgStyle = this.props.small ? {height: 50, width: 50, padding: 5}
      : {height: 70, width: 70, padding: 15};
    return (
      <div id="info-panel" style={{display: "flex"}}>
        <img onClick={() => this.onImageClick_()}
          src={src}
          style={imgStyle}
          alt="album-art"
        />
        <div>
          <div className="track-label" id="name">
            {track ? track.name : 'Track Name'}
          </div>
          <div className="track-label" id="author">
            {
              this.getArtistLinks()
            }
          </div>
          <div className="track-label" id="album">
            {
              this.getAlbumLinks()
            }
          </div>
          <div className="track-label" id="year">
            {track ? track.year : 'Year'}
          </div>
        </div>
      </div>
    );
  }
}
