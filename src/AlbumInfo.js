import Album from './library/Album';
import Library from './library/Library';
import PropTypes from 'prop-types';
import React from 'react';
import {Resources} from './constants';
import {getImgSrc} from './utils';

export default class AlbumInfo extends React.Component {
  constructor(props) {
    super(props);

    this.timer = null;

    this.prevent = false;
  }

  onClickAlbum() {
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
    this.props.playAlbum(this.props.album);
  }

  doClickAlbum() {
    this.props.goToAlbum(this.props.album);
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
        <div style={this.props.style} />
      );
    }
    if (Object.keys(this.props.album.warnings).length > 0) {
      newStyle.backgroundColor = 'yellow';
    }
    if (this.props.album.errors.length > 0) {
      newStyle.backgroundColor = 'red';
    }
    let file = this.props.album && this.props.album.albumArtFile;
    file = file || Resources.DEFAULT_ALBUM;
    const src = getImgSrc(file);
    const artists = this.props.library.getArtistsByIds(
      this.props.album.artistIds).map((artist) => {
      return artist.name;
    }).join(", ");
    return (
      <div
        style={newStyle}
      >
        <div style={{position: "absolute", left: "50%"}}>
          <img
            alt="album art"
            height="100"
            onClick={() => this.onClickAlbum()}
            onDoubleClick={() => this.onDoubleClickAlbum()}
            src={src}
            style={{paddingTop: "10px", position: "relative", left: "-50%"}}
            width="100"
          />
          <div
            style={{position: "relative", left: "-50%", textAlign: 'center'}}
          >
            {this.props.album && this.props.album.name}
          </div>
          <div
            style={{position: "relative", left: "-50%", textAlign: 'center'}}
          >
            {artists}
          </div>
        </div>
      </div>
    );
  }
}

AlbumInfo.propTypes = {
  album: PropTypes.instanceOf(Album),
  goToAlbum: PropTypes.func.isRequired,
  library: PropTypes.instanceOf(Library).isRequired,
  playAlbum: PropTypes.func.isRequired,
  style: PropTypes.shape({
    width: PropTypes.number,
  }).isRequired,
};
