import Playlist from './library/Playlist';
import './PlaylistPicker.css';
import React from 'react';
import {connect} from 'react-redux';
import {getAutoPlaylists, getPlaylists} from './redux/selectors';
import {RootState} from './redux/store';
import WrappedGrid from './WrappedGrid';

interface OwnProps {
  goToPlaylist(playlist: Playlist): void;
}

interface StateProps {
  playlists: Playlist[];
  autoPlaylists: Playlist[];
}

type PlaylistPickerProps = OwnProps & StateProps;

class PlaylistPicker extends React.Component<PlaylistPickerProps> {
  public render(): JSX.Element {
    // TODO: move errors to here instead of a filter
    return (
      <div className="main" >
        <div className="playlistPickerPage" >
          <div className="playlistPickerContainer" >
            Manual
            <WrappedGrid cellRenderer={this.cellRenderer.bind(this)} numItems={this.props.playlists.length} />
          </div>
          <div className="playlistInfoContainer" >
            <span className="titleContainer" >Auto</span>
            <WrappedGrid cellRenderer={this.autoCellRenderer.bind(this)} numItems={this.props.autoPlaylists.length} />
          </div>
        </div>
      </div>
    );
  }

  private renderPlaylist(index: number, key: string, style: React.CSSProperties, playlist: Playlist): JSX.Element {
    if (!playlist) {
      return (
        <div key={key} style={style} />
      );
    }
    const width = style.width as number;
    const newStyle = {
      ...style,
      paddingLeft: (width - 150) / 2,
      paddingRight: (width - 150) / 2,
      width: 150,
    };
    return (
      <div key={key} onClick={() => this.props.goToPlaylist(playlist)} style={newStyle} >
        {playlist.name}
      </div>
    );
  }

  // TODO: make wrappedGrids items actually work and get rid of this
  private autoCellRenderer(index: number, key: string, style: React.CSSProperties): JSX.Element {
    const playlist = this.props.autoPlaylists[index];
    return this.renderPlaylist(index, key, style, playlist);
  }

  // for regular playlists
  private cellRenderer(index: number, key: string, style: React.CSSProperties): JSX.Element {
    const playlist = this.props.playlists[index];
    return this.renderPlaylist(index, key, style, playlist);
  }
}

function mapStateToProps(store: RootState): StateProps {
  return {
    autoPlaylists: getAutoPlaylists(store),
    playlists: getPlaylists(store),
  };
}

export default connect(mapStateToProps)(PlaylistPicker);
