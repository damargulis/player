import AlbumPicker from './AlbumPicker.js';
import React from 'react';
import SongPicker  from './SongPicker.js';
import {getImgSrc} from './utils';
import modifyArtist from './extensions/wiki/artists';

export default class ArtistPage extends React.Component {
  runWiki() {
    modifyArtist(this.props.artist, this.props.library).then(() => {
      this.props.library.save();
    });
  }

  render() {
    const src = getImgSrc(this.props.artist.artFile);
    return (
      <div className="main">
        <div className="pageHolder"
          style={{display: "flex", flexDirection: "column", height: "100%"}}
        >
          <div className="artistPageHeader" style={{display: "flex"}}>
            <div className="info">
              <img src={src} alt="artist art" width="100" height="100" />
              <div>{this.props.artist && this.props.artist.name}</div>
              <button onClick={this.props.goBack}>Back</button>
              <button
                disabled={!this.props.canGoForward}
                onClick={this.props.goForward}
              >
                Forward
              </button>
              <button onClick={this.runWiki.bind(this)}>
              Run Wiki Extension
              </button>
            </div>
          </div>
          <div className="artistPageBody" style={{height: "100%"}}>
            <div className="container" style={{height: "50%"}}>
              <AlbumPicker
                setPlaylistAndPlay={this.props.setPlaylistAndPlay}
                albums={this.props.library.getAlbumsByArtist(this.props.artist)}
                library={this.props.library}
                goToAlbum={this.props.goToAlbum}
              />
            </div> 
            <div className="container" style={{height: "50%"}}>
              <SongPicker
                setPlaylistAndPlay={this.props.setPlaylistAndPlay}
                library={this.props.library}
                songs={this.props.library.getArtistTracks(this.props.artist)}
              
              />
            </div> 
          </div>
        </div>
      </div>
    )
  }
}
