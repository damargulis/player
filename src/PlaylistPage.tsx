import EmptyPlaylist from "./playlist/EmptyPlaylist";
import Library from "./library/Library";
import NavigationBar from "./NavigationBar";
import Playlist from "./library/Playlist";
import React from "react";
import SongPicker from "./SongPicker";
import {toTime} from "./utils";

interface PlaylistPageProps {
  canGoForward: boolean;
  genres: number[];
  goBack: () => void;
  goForward: () => void;
  library: Library;
  playlist: Playlist;
  setPlaylistAndPlay: (playlist: EmptyPlaylist) => void;
}

export default class PlaylistPage extends React.Component<PlaylistPageProps, {}> {

  public render() {
    const src = "";
    const allPlaylistSongs = this.props.library.getTracksByIds(
      this.props.playlist.trackIds);
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
            library={this.props.library}
            setPlaylistAndPlay={this.props.setPlaylistAndPlay}
            songs={songs}
          />
        </div>
      </div>
    );
  }
  private getTotalTime() {
    const songs = this.props.library.getTracksByIds(
      this.props.playlist.trackIds);
    const duration = songs.reduce((total, song) => total + song.duration, 0);
    return toTime(duration);
  }
}
