import Album from "./library/Album";
import modifyAlbum from "./extensions/wiki/albums";
import Artist from "./library/Artist";
import {Resources} from "./constants";
import EditableAttribute from "./EditableAttribute";
import EmptyPlaylist from "./playlist/EmptyPlaylist";
import Library from "./library/Library";
import LikeButton from "./LikeButton";
import NavigationBar from "./NavigationBar";
import RandomAlbumPlaylist from "./playlist/RandomAlbumPlaylist";
import * as React from "react";
import SongPicker from "./SongPicker";
import Track from "./library/Track";
import {getImgSrc, toTime} from "./utils";

interface AlbumPageProps {
  album: Album;
  library: Library;
  canGoForward: boolean;
  goToArtist(artist: Artist): void;
  setPlaylistAndPlay(playlist: EmptyPlaylist): void;
  goBack(): void;
  goForward(): void;
}

export default class AlbumPage extends React.Component<AlbumPageProps> {

  public render(): JSX.Element {
    // TODO: use albumInfo or combine logic
    // ya know actually separate conscers and shit
    let file = this.props.album && this.props.album.albumArtFile;
    file = file || Resources.DEFAULT_ALBUM;
    const src = getImgSrc(file);
    // const artist = this.props.library.getArtistsByIds(
    //  this.props.album.artistIds).map((artist) => {
    //  return artist.name;
    // }).join(", ");
    // todo: set playSong to play an album playlist of by artist ?
    // TODO: add validation to edit year
    return (
      <div className="main">
        <div className="albumPageHeader" style={{display: "flex"}}>
          <div className="info">
            <NavigationBar
              canGoForward={this.props.canGoForward}
              goBack={this.props.goBack}
              goForward={this.props.goForward}
            />
            <img alt="album art" height="100" src={src.toString()} width="100" />
            <EditableAttribute
              attr={this.props.album && this.props.album.name}
              onSave={(value: string) => {
                this.props.album.name = value;
                this.props.library.save();
              }}
            />
            {this.getArtistLinks()}
            <div>Total Time: {this.getTotalTime()}</div>
            <EditableAttribute
              attr={this.props.album.year}
              onSave={(value: number) => {
                this.props.album.year = value;
                this.props.library.save();
              }}
            />
            <button onClick={this.runWiki.bind(this)}>
              Run Wiki Extension
            </button>
          </div>
          <div style={{position: "relative"}}>
            <button
              onClick={this.playAlbum.bind(this)}
              style={{
                position: "absolute",
                top: "33%",
                translate: "translateY(-66%)",
              }}
            >Play Album
            </button>
            <div
              style={{
                position: "absolute",
                top: "66%",
                translate: "translateY(-33%)",
              }}
            >
              <LikeButton
                item={this.props.album}
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
          library={this.props.library}
          setPlaylistAndPlay={this.props.setPlaylistAndPlay}
          songs={this.props.library.getAlbumTracks(this.props.album)}
          sortBy="index"
        />

      </div>
    );
  }

  private runWiki(): void {
    modifyAlbum(this.props.album, this.props.library).then(() => {
      this.props.library.save().then(() => {
        this.forceUpdate();
      });
    });
  }

  private acceptTrackWarnings(): void {
    for (const indexStr in this.props.album.warnings) {
      if (this.props.album.warnings.hasOwnProperty(indexStr)) {
        const index = parseInt(indexStr, 10);
        const track = this.props.library.getTrack(
          this.props.album.trackIds[index]);
        track.name = this.props.album.warnings[indexStr];
      }
    }
    this.props.album.warnings = {};
    this.props.library.save().then(() => {
      this.forceUpdate();
    });
  }

  private getWarnings(): JSX.Element | undefined {
    const warnings = Object.keys(this.props.album.warnings);
    if (!warnings.length) {
      return;
    }
    return (
      <div style={{
        border: "solid yellow 5px",
        marginBottom: "10px",
        marginLeft: "100px",
        marginTop: "10px",
      }}
      >
        <div> Warnings: </div>
        {
          warnings.map((trackIndex) => {
            return (
              <div key={trackIndex}>{parseInt(trackIndex, 10) + 1 + ": " +
                this.props.album.warnings[trackIndex]}
              </div>
            );
          })
        }
        <button onClick={this.acceptTrackWarnings.bind(this)}>Accept</button>
      </div>
    );
  }

  private getErrors(): JSX.Element | undefined {
    if (!this.props.album.errors.length) {
      return;
    }
    return (
      <div style={{
        border: "solid red 1px",
        marginBottom: "10px",
        marginLeft: "100px",
        marginTop: "10px",
      }}
      >
        <div> Errors: </div>
        {
          this.props.album.errors.map((error: string) => {
            return (
              <div key={error}>{error}</div>
            );
          })
        }
      </div>

    );
  }

  private getArtistLinks(): JSX.Element[] | undefined {
    if (!this.props.album) {
      return;
    }
    const artists = this.props.library.getArtistsByIds(
      this.props.album.artistIds);
    return artists.map((artist: Artist) => {
      return (
        <div key={artist.id}>
          <div className="link" onClick={() => this.props.goToArtist(artist)}>
            {artist.name}
          </div>
        </div>
      );
    });
  }

  private getTotalTime(): string {
    const songs = this.props.library.getAlbumTracks(this.props.album);
    const duration = songs.reduce((total: number, song: Track) => total + song.duration, 0);
    return toTime(duration);
  }

  private playAlbum(): void {
    const playlist = new RandomAlbumPlaylist(
      this.props.library, [this.props.album]);
    playlist.addAlbum(this.props.album);
    this.props.setPlaylistAndPlay(playlist);
  }
}
