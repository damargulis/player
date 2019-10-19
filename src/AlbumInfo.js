import React from 'react';

const path = require('path');

export default class AlbumInfo extends React.Component {
  constructor(props) {
    super(props);

    this.timer = null;

    this.prevent = false;
  }

  onClickAlbum(index) {
    this.timer = setTimeout(() => {
      if (!this.prevent) {
        this.doClickAlbum();
      }
      this.prevent = false;
    }, 200);
  }

  onDoubleClickAlbum() {
    clearTimeout(this.timer);
    this.prevent = true;
    this.doDoubleClickAlbum();
  }

  doDoubleClickAlbum() {
    this.props.playAlbum(this.props.album)
  }

  doClickAlbum(index) {
  }

  render() {
    // recenter with new width filling full space
    const newStyle = {
      ...this.props.style,
      paddingLeft: (this.props.style.width - 150) / 2,
      paddingRight: (this.props.style.width - 150) / 2,
      width: 150
    };
    if (!this.props.album) {
      return (
        <div style={this.props.stlye} />
      )
    }
    const file = this.props.album && this.props.album.albumArtFile;
    const src = file ? new URL('file://' + path.resolve(file)) : null;
    const artist = this.props.library.getArtistsByIds(this.props.album.artistIds).map((artist) => {
      return artist.name;
    }).join(", ");
    return (
      <div
        style={newStyle}
      >
        <div style={{position: "absolute", left: "50%"}}>
        <img onDoubleClick={() => this.onDoubleClickAlbum()} onClick={() => this.onClickAlbum()} style={{paddingTop: "10px", position: "relative", left: "-50%"}} src={src} alt="album art" width="100" height="100" />
        <div style={{position: "relative", left: "-50%", textAlign: 'center'}}>{this.props.album && this.props.album.name}</div>
        <div style={{position: "relative", left: "-50%", textAlign: 'center'}}>{artist}</div>
        </div>
      </div>
    )
  }
}
