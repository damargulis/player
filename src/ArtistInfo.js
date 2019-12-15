import Artist from './library/Artist';
import Library from './library/Library';
import PropTypes from 'prop-types';
import React from 'react';
import {Resources} from './constants';
import {getImgSrc} from './utils';

/**
 * Gets album arts from all albums from an artist.
 * @param {!Library} library The library artist is from.
 * @param {!Artist} artist The artist to get the albums from.
 * @return {!Array<string>} The album art files.
 */
function getAlbumArtFiles(library, artist) {
  const albums = library.getAlbumsByIds(artist.albumIds);
  return albums.map((album) => album.albumArtFile).filter(Boolean);
}

export default class ArtistInfo extends React.Component {
  constructor(props) {
    super(props);

    const file = this.props.artist.artFile;
    this.artFiles = [
      file,
      ...getAlbumArtFiles(props.library, props.artist)
    ].filter(Boolean);
    this.state = {
      currentImg: 0,
      timerId: null,
    };
  }

  componentDidMount() {
    if (!this.props.artist) {
      return;
    }
    const time = 10000;
    const timeoutId = setTimeout(() => {
      const id = setInterval(() => {
        if (!this.props.artist) {
          return;
        }
        this.setState({
          currentImg:
            (this.state.currentImg + 1) % this.artFiles.length,
        });
      }, time);
      if (!this.props.artist) {
        return;
      }
      this.setState({
        timerId: id,
        currentImg:
          (this.state.currentImg + 1) % this.artFiles.length,
      });
    }, Math.random() * time);
    this.setState({
      timerId: timeoutId
    });
  }

  componentWillUnmount() {
    clearInterval(this.state.timerId);
  }

  render() {
    if (!this.props.artist) {
      return (
        <div style={this.props.style} />
      );
    }
    // recenter with new width filling full space
    const newStyle = {
      ...this.props.style,
      paddingLeft: (this.props.style.width - 150) / 2,
      paddingRight: (this.props.style.width - 150) / 2,
      width: 150
    };
    if (this.props.artist.errors.length > 0) {
      newStyle.backgroundColor = 'red';
    }
    let file = this.artFiles[this.state.currentImg];
    file = file || Resources.DEFAULT_ARTIST;
    const src = getImgSrc(file);
    return (
      <div
        onClick={() => this.props.goToArtist(this.props.artist)}
        style={newStyle}
      >
        <div style={{position: "absolute", left: "50%"}}>
          <img
            alt="artist art"
            height="100"
            src={src}
            style={{paddingTop: "10px", position: "relative", left: "-50%"}}
            width="100"
          />
          <div
            style={{position: "relative", left: "-50%", textAlign: 'center'}}
          >
            {this.props.artist.name}
          </div>
        </div>
      </div>
    );
  }
}

ArtistInfo.propTypes = {
  artist: PropTypes.instanceOf(Artist).isRequired,
  goToArtist: PropTypes.func.isRequired,
  library: PropTypes.instanceOf(Library).isRequired,
  style: PropTypes.object.isRequired,
};
