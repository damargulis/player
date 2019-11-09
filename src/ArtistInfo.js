import React from 'react';
import {getImgSrc} from './utils';

export default class ArtistInfo extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      currentImg: 0,
      timerId: null,
    }

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
            (this.state.currentImg + 1) % this.props.artist.albumIds.length,
        })
      }, time);
      if (!this.props.artist) {
        return;
      }
      this.setState({
        timerId: id,
        currentImg:
          (this.state.currentImg + 1) % this.props.artist.albumIds.length,
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
        <div style={this.props.stlye} />
      )
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
    // add in into the rotation instead?
    let file = this.props.artist.artFile;
    if (!file) {
      const albums = this.props.library.getAlbumsByIds(
        this.props.artist.albumIds);
      const album = albums[this.state.currentImg];
      file = album && album.albumArtFile;
    }
    const src = getImgSrc(file);
    return (
      <div
        style={newStyle}
        onClick={() => this.props.goToArtist(this.props.artist)}
      >
        <div style={{position: "absolute", left: "50%"}}>
          <img
            style={{paddingTop: "10px", position: "relative", left: "-50%"}}
            src={src} alt="artist art" width="100" height="100"
          />
          <div
            style={{position: "relative", left: "-50%", textAlign: 'center'}}>
            {this.props.artist.name}
          </div>
        </div>
      </div>
    )
  }
}
