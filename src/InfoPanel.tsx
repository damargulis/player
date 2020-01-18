import Album from "./library/Album";
import Artist from "./library/Artist";
import { ipcRenderer } from "electron";
import Marquee from "./Marquee";
import defaultAlbum from "./resources/missing_album.png";
import React from "react";
import { connect } from "react-redux";
import { getAlbumsByIds, getArtistsByIds, getCurrentTrack } from "./redux/selectors";
import { RootState } from "./redux/store";
import Track from "./library/Track";
import { getImgSrc } from "./utils";

import "./InfoPanel.css";

interface OwnProps {
  small?: boolean;
  goToAlbum(album: Album): void;
  goToArtist(artist: Artist): void;
  goToSong(track: Track): void;
}

interface StateProps {
  albums: Album[];
  artists: Artist[];
  track?: Track;
}

type InfoPanelProps = OwnProps & StateProps;

class InfoPanel extends React.Component<InfoPanelProps> {

  public render(): JSX.Element {
    const { track, albums} = this.props;
    const album = albums[0];
    const src = album && album.albumArtFile ? getImgSrc(album.albumArtFile) : defaultAlbum;
    // TODO: make rotate instead -- conditionally on playlist type??
    // meaning like if its playing a specific album, only show that album
    // (and artwork)
    // if on song shuffle, then rotate between all.
    const imgStyle = this.props.small ? { height: 50, width: 50, padding: 5}
      : { height: 70, width: 70, padding: 15};
    return (
      <div id="info-panel" style={ { display: "flex"}}>
        <img alt="album-art"
          onClick={ () => this.onImageClick()}
          src={ src}
          style={ imgStyle}
        />
        <div style={ { display: "grid"}}>
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
            { track ? track.year : "Year"}
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

  private getArtistLinks(): JSX.Element | string {
    const { artists} = this.props;
    if (!artists.length) {
      return "Artists";
    }
    return (
      <Marquee>
        {
          artists.map((artist) => {
            return (
              <span key={ artist.id} className="link" onClick={ () => this.props.goToArtist(artist)}>
                { artist.name}
              </span>
            );
          })
        }
      </Marquee>
    );
  }

  private getAlbumLinks(): JSX.Element | string {
    const { albums} = this.props;
    if (!albums.length) {
      return "Albums";
    }
    return (
      <Marquee>
        {
          albums.map((album) => {
            return (
              <span key={ album.id} className="link" onClick={ () => this.props.goToAlbum(album)}>
                { album.name}
              </span>
            );
          })
        }
      </Marquee>
    );
  }

  private getNameLink(): JSX.Element | string {
    if (this.props.track) {
      return (
        <Marquee>
          <span className="link" onClick={ () => this.goToSong(this.props.track)} >
            { this.props.track.name}
          </span>
        </Marquee>
      );
    }
    return "Track Name";
  }
}

function mapStateToProps(state: RootState, ownProps: OwnProps): StateProps {
  const track = getCurrentTrack(state);
  const albums = track ? getAlbumsByIds(state, track.albumIds) : [];
  const artists = track ? getArtistsByIds(state, track.artistIds) : [];
  return {
    albums,
    artists,
    track,
  };
}

export default connect(mapStateToProps)(InfoPanel);
