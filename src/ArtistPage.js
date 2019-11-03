import React from 'react';
import SongPicker  from './SongPicker.js';
import AlbumPicker from './AlbumPicker.js';

export default class ArtistPage extends React.Component {
  render() {
    const src = "";
    return (
      <div className="main">
        <div className="artistPageHeader" style={{display: "flex"}}>
        <div className="info">
          <img src={src} alt="artist art" width="100" height="100" />
          <div>{this.props.artist && this.props.artist.name}</div>
          <button onClick={this.props.goBack}>Back</button>
        </div>
        </div>
        <div className="artistPageBody" style={{height: "100%"}}>
          <div className="container" style={{height: "50%"}}>
            <AlbumPicker
              albums={this.props.library.getAlbumsByArtist(this.props.artist)}
              library={this.props.library}
              goToAlbum={this.props.goToAlbum}
            />
          </div> 
          <div className="container" style={{height: "50%"}}>
            <SongPicker
          library={this.props.library}
          songs={this.props.library.getArtistTracks(this.props.artist)}
              
            />
          </div> 
        </div>
      </div>
    )
  }
}
