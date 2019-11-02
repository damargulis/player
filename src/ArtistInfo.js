import React from 'react';

const path = require('path');

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
    setTimeout(() => {
      const time = Math.random() * 1000 + 4000;
      const id = setInterval(() => {
        this.setState({
          currentImg: (this.state.currentImg + 1) % this.props.artist.albumIds.length,
        })
      }, time);
      this.setState({
        timerId: id,
      });
    }, Math.random() * 5000);
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
    const albums = this.props.library.getAlbumsByIds(this.props.artist.albumIds);
    const album = albums[this.state.currentImg];
    const file = album && album.albumArtFile;
    const src = file ? new URL('file://' + path.resolve(file)) : null;
    return (
      <div
        style={newStyle}
        onClick={() => this.props.goToArtist(this.props.artist)}
      >
        <div style={{position: "absolute", left: "50%"}}>
          <img style={{paddingTop: "10px", position: "relative", left: "-50%"}} src={src} alt="artist art" width="100" height="100" />
          <div style={{position: "relative", left: "-50%", textAlign: 'center'}}>{this.props.artist.name}</div>
        </div>
      </div>
    )
  }
}
