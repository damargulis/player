import EditableAttribute from './EditableAttribute';
import LikeButton from './LikeButton';
import NavigationBar from './NavigationBar';
import RandomAlbumPlaylist from './playlist/RandomAlbumPlaylist';
import React from 'react';
import {Resources} from './constants';
import SongPicker from './SongPicker.js';
import modifyAlbum from './extensions/wiki/albums';
import {getImgSrc, toTime} from './utils';

export default class AlbumPicker extends React.Component {
  runWiki() {
    modifyAlbum(this.props.album, this.props.library).then(() => {
      this.props.library.save().then(() => {
        this.forceUpdate();
      });
    });
  }

  acceptTrackWarnings() {
    for (const indexStr in this.props.album.warnings) {
      const index = parseInt(indexStr);
      const track = this.props.library.getTrack(
        this.props.album.trackIds[index]);
      track.name = this.props.album.warnings[indexStr];
    }
    this.props.album.warnings = {};
    this.props.library.save().then(() => {
      this.forceUpdate();
    });
  }

  getWarnings() {
    const warnings = Object.keys(this.props.album.warnings);
    if (!warnings.length) {
      return null;
    }
    return (
      <div style={{
        border: "solid yellow 5px",
        marginTop: "10px",
        marginBottom: "10px",
        marginLeft: "100px",
      }} >
        <div> Warnings: </div>
        {
          warnings.map((trackIndex) => {
            return (
              <div key={trackIndex}>{parseInt(trackIndex) + 1 + ": " +
                this.props.album.warnings[trackIndex]}</div>
            );
          })
        }
        <button onClick={this.acceptTrackWarnings.bind(this)}>Accept</button>
      </div>
    );
  }

  getErrors() {
    if (!this.props.album.errors.length) {
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
          this.props.album.errors.map((error, index) => {
            return (
              <div key={index}>{error}</div>
            );
          })
        }
      </div>

    );
  }

  getArtistLinks() {
    if (!this.props.album) {
      return null;
    }
    const artists = this.props.library.getArtistsByIds(
      this.props.album.artistIds);
    return artists.map((artist, index) => {
      return (
        <div key={index}>
          <div className="link" onClick={() => this.props.goToArtist(artist)}>
            {artist.name}
          </div>
        </div>
      );
    });
  }

  getTotalTime() {
    const songs = this.props.library.getAlbumTracks(this.props.album);
    const duration = songs.reduce((total, song) => total + song.duration, 0);
    return toTime(duration);
  }

  playAlbum() {
    const playlist = new RandomAlbumPlaylist(
      this.props.library, [this.props.album]);
    playlist.addAlbum(this.props.album);
    this.props.setPlaylistAndPlay(playlist);
  }

  render() {
    // todo use albumInfo or combine logic
    // ya know actually separate conscers and shit
    let file = this.props.album && this.props.album.albumArtFile;
    file = file || Resources.DEFAULT_ALBUM;
    const src = getImgSrc(file);
    //const artist = this.props.library.getArtistsByIds(
    //  this.props.album.artistIds).map((artist) => {
    //  return artist.name;
    //}).join(", ");
    // todo: set playSong to play an album playlist of by artist ?
    // TODO: add validation to edit year
    return (
      <div className="main">
        <div className="albumPageHeader" style={{display: "flex"}}>
          <div className="info">
            <NavigationBar
              goBack={this.props.goBack}
              goForward={this.props.goForward}
              canGoForward={this.props.canGoForward}
            />
            <img src={src} alt="album art" width="100" height="100" />
            <EditableAttribute
              attr={this.props.album && this.props.album.name}
              onSave={(value) => {
                this.props.album.name = value;
                this.props.library.save();
              }}
            />
            {this.getArtistLinks()}
            <div>Total Time: {this.getTotalTime()}</div>
            <EditableAttribute
              attr={this.props.album.year}
              onSave={(value) => {
                this.props.album.year = value;
                this.props.library.save();
              }}
            />
            <button onClick={this.runWiki.bind(this)}>
              Run Wiki Extension
            </button>
          </div>
          <div style={{position: 'relative'}}>
            <button
              onClick={this.playAlbum.bind(this)}
              style={{
                position: 'absolute',
                top: '33%',
                translate: 'translateY(-66%)'
              }}
            >Play Album</button>
            <div
              style={{
                position: 'absolute',
                top: '66%',
                translate: 'translateY(-33%)',
              }}
            >
              <LikeButton
                track={this.props.album}
                library={this.props.library}
              />
            </div>
          </div>
          {
            this.getErrors()
          }
          {
            this.getWarnings()
          }
        </div>
        <SongPicker
          sortBy="index"
          setPlaylistAndPlay={this.props.setPlaylistAndPlay}
          songs={this.props.library.getAlbumTracks(this.props.album)}
          library={this.props.library}
        />

      </div>
    );
  }
}
