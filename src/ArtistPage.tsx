import Album from "./library/Album";
import AlbumPicker from "./AlbumPicker";
import Artist from "./library/Artist";
import runArtistModifier from "./extensions/wiki/artists";
import EditableAttribute from "./EditableAttribute";
import EmptyPlaylist from "./playlist/EmptyPlaylist";
import Library from "./library/Library";
import defaultArtist from "./resources/missing_artist.png";
import NavigationBar from "./NavigationBar";
import React from "react";
import SongPicker from "./SongPicker";
import {getImgSrc} from "./utils";
import {RootState} from "./redux/store";
import { connect } from "react-redux";
import Track from "./library/Track";
import {getAlbumsByIds, getTracksByIds} from "./redux/selectors";

interface ArtistPageProps {
  artist: Artist;
  albums: Album[];
  canGoForward: boolean;
  goBack(): void;
  goForward(): void;
  goToAlbum(album: Album): void;
  setPlaylistAndPlay(playlist: EmptyPlaylist): void;
  runArtistModifier(artist: Artist): Promise<void>;
  tracks: Track[];
}

class ArtistPage extends React.Component<ArtistPageProps> {

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
                albums={this.props.albums}
                goToAlbum={this.props.goToAlbum}
                setPlaylistAndPlay={this.props.setPlaylistAndPlay}
              />
            </div>
            <div className="container" style={{height: "50%"}}>
              <SongPicker
                setPlaylistAndPlay={this.props.setPlaylistAndPlay}
                songs={this.props.tracks}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  private runWiki(): void {
    this.props.runArtistModifier(this.props.artist);
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

interface OwnProps {
  artist: Artist;
}

function mapStateToProps(store: RootState, ownProps: OwnProps) {
  return {
    runArtistModifier: (artist: Artist) => runArtistModifier(store, artist),
    albums: getAlbumsByIds(store, ownProps.artist.albumIds),
    tracks: getTracksByIds(store, ownProps.artist.trackIds),
  }
}

export default connect(mapStateToProps)(ArtistPage);
