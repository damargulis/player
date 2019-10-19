import React from 'react';

const {ipcRenderer} = require('electron');
const path = require('path');

export default class InfoPanel extends React.Component {

  onImageClick_() {
    ipcRenderer.send('minimize');
  }

  render() {
    const {track, library} = this.props;
    const albums = track && library ? library.getAlbumsByIds(track.albumIds) : [];
    const album = albums[0];
    const imageSrc = album && album.albumArtFile ? new URL('file://' + path.resolve(album.albumArtFile)) : null;
    const src = imageSrc;
    const artists = track && library ? library.getArtistsByIds(track.artistIds) : [];
    const artistNames = artists.map(artist => artist.name).join(', ');
    // TODO: make rotate instead -- conditionally on playlist type??
    // meaning like if its playing a specific album, only show that album (and artwork)
    // if on song shuffle, then rotate between all.
    const albumNames = albums.map(album => album.name).join(', ');
    return (
        <div id="info-panel" style={{display: "flex"}}>
          <img onClick={() => this.onImageClick_()} src={src} style={{height: 70, width: 70, padding: 15}} alt="album-art"/>
          <div>
            <div id="name">{track ? track.name : 'Track Name'}</div>
            <div id="author">{artistNames ? artistNames : 'Artist Name'}</div>
            <div id="album">{albumNames ? albumNames : 'Album Name'}</div>
            <div id="year">{track ? track.year : 'Year'}</div>
          </div>
        </div>
    )
  }
}
