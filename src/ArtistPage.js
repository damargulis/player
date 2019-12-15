import AlbumPicker from './AlbumPicker.js';
import EditableAttribute from './EditableAttribute';
import Library from './library/Library';
import NavigationBar from './NavigationBar';
import PropTypes from 'prop-types';
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
          this.props.artist.errors.map((error) => {
            return (
              <div key={error}>{error}</div>
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
              canGoForward={this.props.canGoForward}
              goBack={this.props.goBack}
              goForward={this.props.goForward}
            />
            <div className="info">
              <img alt="artist art" height="100" src={src} width="100" />
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
                albums={this.props.library.getAlbumsByArtist(this.props.artist)}
                goToAlbum={this.props.goToAlbum}
                library={this.props.library}
                setPlaylistAndPlay={this.props.setPlaylistAndPlay}
              />
            </div>
            <div className="container" style={{height: "50%"}}>
              <SongPicker
                library={this.props.library}
                setPlaylistAndPlay={this.props.setPlaylistAndPlay}
                songs={this.props.library.getArtistTracks(this.props.artist)}

              />
            </div>
          </div>
        </div>
      </div>
    );
  }
}

ArtistPage.propTypes = {
  artist: PropTypes.array.isRequired,
  canGoForward: PropTypes.func.isRequired,
  goBack: PropTypes.func.isRequired,
  goForward: PropTypes.func.isRequired,
  goToAlbum: PropTypes.func.isRequired,
  library: PropTypes.instanceOf(Library).isRequired,
  setPlaylistAndPlay: PropTypes.func.isRequired,
};
