import Album from "./library/Album";
import AlbumPicker from "./AlbumPicker";
import Artist from "./library/Artist";
import modifyArtist from "./extensions/wiki/artists";
import EditableAttribute from "./EditableAttribute";
import EmptyPlaylist from "./playlist/EmptyPlaylist";
import Library from "./library/Library";
import defaultArtist from "./resources/missing_artist.png";
import NavigationBar from "./NavigationBar";
import React from "react";
import SongPicker from "./SongPicker";
import {getImgSrc} from "./utils";

interface ArtistPageProps {
  artist: Artist;
  library: Library;
  canGoForward: boolean;
  goBack(): void;
  goForward(): void;
  goToAlbum(album: Album): void;
  setPlaylistAndPlay(playlist: EmptyPlaylist): void;
}

export default class ArtistPage extends React.Component<ArtistPageProps> {

  public render(): JSX.Element {
    const src = this.props.artist.artFile ? getImgSrc(this.props.artist.artFile) : defaultArtist;
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
                onSave={(value: string) => {
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
                songs={this.props.library.getTracksByIds(this.props.artist.trackIds)}

              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  private runWiki(): void {
    modifyArtist(this.props.artist, this.props.library).then(() => {
      this.props.library.save();
    });
  }

  private getErrors(): JSX.Element | undefined {
    if (!this.props.artist.errors.length) {
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
          this.props.artist.errors.map((error) => {
            return (
              <div key={error}>{error}</div>
            );
          })
        }
      </div>

    );
  }
}
