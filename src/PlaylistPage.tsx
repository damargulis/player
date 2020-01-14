import EmptyPlaylist from "./playlist/EmptyPlaylist";
import Library from "./library/Library";
import NavigationBar from "./NavigationBar";
import Playlist from "./library/Playlist";
import React from "react";
import SongPicker from "./SongPicker";
import {toTime} from "./utils";
import Track from "./library/Track";
import { connect } from "react-redux";
import {RootState} from "./redux/store";
import {getTracksByIds} from "./redux/selectors";

interface PlaylistPageProps {
  tracks: Track[];
  canGoForward: boolean;
  genres: number[];
  playlist: Playlist;
  goBack(): void;
  goForward(): void;
  setPlaylistAndPlay(playlist: EmptyPlaylist): void;
}

class PlaylistPage extends React.Component<PlaylistPageProps> {

  public render(): JSX.Element {
    const src = "";
    const allPlaylistSongs = this.props.tracks;
    const songs = allPlaylistSongs.filter((song) => {
      if (this.props.genres.length) {
        return song.genreIds.some((genreId) => {
          return this.props.genres.includes(genreId);
        });
      }
      return true;
    });
    return (
      <div className="main">
        <div className="playlistPageHeader" style={{display: "flex"}}>
          <div className="info">
            <NavigationBar
              canGoForward={this.props.canGoForward}
              goBack={this.props.goBack}
              goForward={this.props.goForward}
            />
            <img alt="playlist" height="100" src={src} width="100" />
            <div>{this.props.playlist && this.props.playlist.name}</div>
            <div>Total Time: {this.getTotalTime()}</div>
          </div>
        </div>
        <div className="playlistPageBody" style={{height: "100%"}}>
          <SongPicker
            setPlaylistAndPlay={this.props.setPlaylistAndPlay}
            songs={songs}
          />
        </div>
      </div>
    );
  }

  private getTotalTime(): string {
    const duration = this.props.tracks.reduce((total, song) => total + song.duration, 0);
    return toTime(duration);
  }
}

interface OwnProps {
  playlist: Playlist;
}

function mapStateToProps(store: RootState, ownProps: OwnProps) {
  return {
    tracks: getTracksByIds(store, ownProps.playlist.trackIds),
  }
}

export default connect(mapStateToProps)(PlaylistPage);
