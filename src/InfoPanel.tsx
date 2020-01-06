import Album from "./library/Album";
import Artist from "./library/Artist";
import {ipcRenderer} from "electron";
import Library from "./library/Library";
import defaultAlbum from "./resources/missing_album.png";
import React from "react";
import Track from "./library/Track";
import {getImgSrc} from "./utils";

interface InfoPanelProps {
  library: Library;
  track?: Track;
  small?: boolean;
  goToAlbum(album: Album): void;
  goToArtist(artist: Artist): void;
  goToSong(track: Track): void;
}

export default class InfoPanel extends React.Component<InfoPanelProps> {

  public render(): JSX.Element {
    const {track, library} = this.props;
    const albums = track && library
      ? library.getAlbumsByIds(track.albumIds) : [];
    const album = albums[0];
    const src = album && album.albumArtFile ? getImgSrc(album.albumArtFile) : defaultAlbum;
    // TODO: make rotate instead -- conditionally on playlist type??
    // meaning like if its playing a specific album, only show that album
    // (and artwork)
    // if on song shuffle, then rotate between all.
    const imgStyle = this.props.small ? {height: 50, width: 50, padding: 5}
      : {height: 70, width: 70, padding: 15};
    return (
      <div id="info-panel" style={{display: "flex"}}>
        <img alt="album-art"
          onClick={() => this.onImageClick()}
          src={src}
          style={imgStyle}
        />
        <div>
          <div className="track-label" id="name">
            { this.getNameLink() }
          </div>
          <div className="track-label" id="author">
            {
              this.getArtistLinks()
            }
          </div>
          <div className="track-label" id="album">
            {
              this.getAlbumLinks()
            }
          </div>
          <div className="track-label" id="year">
            {track ? track.year : "Year"}
          </div>
        </div>
      </div>
    );
  }

  private goToSong(song?: Track): void {
    if (song) {
      this.props.goToSong(song);
    }
  }

  private onImageClick(): void {
    if (this.props.small) {
      ipcRenderer.send("maximize");
    } else {
      ipcRenderer.send("minimize");
    }
  }

  private getArtistLinks(): JSX.Element[] | string {
    const {track, library} = this.props;
    const artists = track && library
      ? library.getArtistsByIds(track.artistIds) : [];
    if (artists.length) {
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
    return "Artists";
  }

  private getAlbumLinks(): JSX.Element[] | string {
    const {track, library} = this.props;
    const albums = track && library
      ? library.getAlbumsByIds(track.albumIds) : [];
    if (albums.length) {
      return albums.map((album: Album) => {
        return (
          <div key={album.id}>
            <div className="link" onClick={() => this.props.goToAlbum(album)}>
              {album.name}
            </div>
          </div>
        );
      });
    }
    return "Albums";
  }

  private getNameLink(): JSX.Element | string {
    if (this.props.track) {
      return (
        <div className="link" onClick={() => this.goToSong(this.props.track)} >
          {this.props.track.name}
        </div>
      );
    }
    return "Track Name";
  }
}
