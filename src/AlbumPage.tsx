import {save, setPlaylist} from "./redux/actions";
import Album from "./library/Album";
import runAlbumModifier from "./extensions/wiki/albums";
import Artist from "./library/Artist";
import EditableAttribute from "./EditableAttribute";
import EmptyPlaylist from "./playlist/EmptyPlaylist";
import LikeButton from "./LikeButton";
import defaultAlbum from "./resources/missing_album.png";
import NavigationBar from "./NavigationBar";
import RandomAlbumPlaylist from "./playlist/RandomAlbumPlaylist";
import * as React from "react";
import {connect} from "react-redux";
import {getArtistsByIds, getTrackById, getTracksByIds} from "./redux/selectors";
import SongPicker from "./SongPicker";
import {RootState} from "./redux/store";
import Track from "./library/Track";
import {getImgSrc, toTime} from "./utils";

interface StateProps {
  artists: Artist[];
  tracks: Track[];
  getTracksByIds(ids: number[]): Track[];
  getTrackById(id: number): Track;
  runAlbumModifier(album: Album): Promise<void>;
}

interface OwnProps {
  album: Album;
  canGoForward: boolean;
  goToArtist(artist: Artist): void;
  goBack(): void;
  goForward(): void;
}

interface DispatchProps {
  setPlaylist(playlist: EmptyPlaylist, play: boolean): void;
  save(): void;
}

type AlbumPageProps = OwnProps & StateProps & DispatchProps;

class AlbumPage extends React.Component<AlbumPageProps> {

  public render(): JSX.Element {
    // TODO: use albumInfo or combine logic
    // ya know actually separate conscers and shit
    const file = this.props.album && this.props.album.albumArtFile;
    const src = file ? getImgSrc(file).toString() : defaultAlbum;
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
            <img alt="album art" height="100" src={src} width="100" />
            <EditableAttribute
              attr={this.props.album && this.props.album.name}
              onSave={(value: string) => {
                this.props.album.name = value;
              }}
            />
            {this.getArtistLinks()}
            <div>Total Time: {this.getTotalTime()}</div>
            <EditableAttribute
              attr={this.props.album.year}
              onSave={(value: number) => {
                this.props.album.year = value;
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
              <LikeButton item={this.props.album} />
            </div>
          </div>
          {this.getErrors()}
          {this.getWarnings()}
        </div>
        <SongPicker songs={this.props.getTracksByIds(this.props.album.trackIds)} sortBy="index" />
      </div>
    );
  }

  private runWiki(): void {
    this.props.runAlbumModifier(this.props.album).then(() => {
      this.props.save();
    });
  }

  private acceptTrackWarnings(): void {
    for (const indexStr in this.props.album.warnings) {
      if (this.props.album.warnings.hasOwnProperty(indexStr)) {
        const index = parseInt(indexStr, 10);
        const track = this.props.getTrackById(this.props.album.trackIds[index]);
        track.name = this.props.album.warnings[indexStr];
      }
    }
    this.props.album.warnings = {};
    this.props.save();
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
    return this.props.artists.map((artist: Artist) => {
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
    const duration = this.props.tracks.reduce((total: number, song: Track) => total + song.duration, 0);
    return toTime(duration);
  }

  private playAlbum(): void {
    const playlist = new RandomAlbumPlaylist([this.props.album]);
    this.props.setPlaylist(playlist, /* play= */ true);
  }
}

function mapStateToProps(state: RootState, ownProps: OwnProps): StateProps {
  return {
    artists: getArtistsByIds(state, ownProps.album.artistIds),
    getTrackById: (id: number) => getTrackById(state, id),
    getTracksByIds: (ids: number[]) => getTracksByIds(state, ids),
    runAlbumModifier: (album: Album) => runAlbumModifier(state, album),
    tracks: getTracksByIds(state, ownProps.album.trackIds),
  };
}

export default connect(mapStateToProps, { setPlaylist, save })(AlbumPage);
