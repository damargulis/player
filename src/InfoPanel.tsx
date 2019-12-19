import Album from './library/Album';
import Artist from './library/Artist';
import Library from './library/Library';
import React from 'react';
import {Resources} from './constants';
import Track from './library/Track';
import {getImgSrc} from './utils';

const {ipcRenderer} = require('electron');

interface InfoPanelProps {
  goToAlbum: (album: Album) => void;
  goToArtist: (artist: Artist) => void;
  goToSong: (track: Track) => void;
  library: Library;
  track?: Track;
  small?: boolean;
}

export default class InfoPanel extends React.Component<InfoPanelProps,{}> {
  goToSong(song?: Track) {
    if (song) {
      this.props.goToSong(song);
    }
  }

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
      return artists.map((artist: Artist) => {
        return (
          <div key={artist.id}>
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
    if (albums.length) {
      return albums.map((album: Album) => {
        return (
          <div key={album.id}>
            <div className="link" onClick={() => this.props.goToAlbum(album)}>
              {album.name}
            </div>
          </div>
        );
      });
    }
    return "Albums";
  }

  getNameLink() {
    if (this.props.track) {
      return (
        <div className="link"
          onClick={() => this.goToSong(this.props.track)}
        >
          {this.props.track.name}
        </div>
      );
    }
    return 'Track Name';
  }

  render() {
    const {track, library} = this.props;
    const albums = track && library
      ? library.getAlbumsByIds(track.albumIds) : [];
    const album = albums[0];
    const src = getImgSrc(
      (album && album.albumArtFile) || Resources.DEFAULT_ALBUM);
    // TODO: make rotate instead -- conditionally on playlist type??
    // meaning like if its playing a specific album, only show that album
    // (and artwork)
    // if on song shuffle, then rotate between all.
    const imgStyle = this.props.small ? {height: 50, width: 50, padding: 5}
      : {height: 70, width: 70, padding: 15};
    return (
      <div id="info-panel" style={{display: "flex"}}>
        <img alt="album-art"
          onClick={() => this.onImageClick_()}
          src={src}
          style={imgStyle}
        />
        <div>
          <div className="track-label" id="name">
            { this.getNameLink() }
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
