import AlbumPicker from './AlbumPicker.js';
import EditableAttribute from './EditableAttribute';
import NavigationBar from './NavigationBar';
import React from 'react';
import {Resources} from './constants';
import SongPicker from './SongPicker.js';
import {getImgSrc} from './utils';
import modifyArtist from './extensions/wiki/artists';

export default class ArtistPage extends React.Component {
  runWiki() {
    modifyArtist(this.props.artist, this.props.library).then(() => {
      this.props.library.save();
    });
  }

  getErrors() {
    if (!this.props.artist.errors.length) {
      return null;
    }
    return (
      <div style={{
        border: "solid red 1px",
        marginTop: "10px",
        marginBottom: "10px",
        marginLeft: "100px",
      }}
      >
        <div> Errors: </div>
        {
          this.props.artist.errors.map((error, index) => {
            return (
              <div key={index}>{error}</div>
            );
          })
        }
      </div>

    );
  }

  render() {
    const src = getImgSrc(
      this.props.artist.artFile || Resources.DEFAULT_ARTIST);
    return (
      <div className="main">
        <div className="pageHolder"
          style={{display: "flex", flexDirection: "column", height: "100%"}}
        >
          <div className="artistPageHeader" style={{display: "flex"}}>
            <NavigationBar
              goBack={this.props.goBack}
              goForward={this.props.goForward}
              canGoForward={this.props.canGoForward}
            />
            <div className="info">
              <img src={src} alt="artist art" width="100" height="100" />
              <EditableAttribute
                attr={this.props.artist && this.props.artist.name}
                onSave={(value) => {
                  this.props.artist.name = value;
                  this.props.library.save();
                }}
              />
              <button onClick={this.runWiki.bind(this)}>
              Run Wiki Extension
              </button>
            </div>
            {
              this.getErrors()
            }
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
    );
  }
}
