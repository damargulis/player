import React from 'react';
import WrappedGrid from './WrappedGrid';
import Playlist from './library/Playlist';

function getUnlistened(library) {
  const tracks = library.getTracks().filter((track) => {
    return track.playCount === 0;
  }).map((track) => {
    return track.id;
  });
  return new Playlist({name: "Unheard", trackIds: tracks});
}

function getMostPlayed(library) {
  const tracks = library.getTracks().slice().sort((track1, track2) => {
    return track2.playCount - track1.playCount;
  }).slice(0, 100).map((track) => {
    return track.id;
  });
  return new Playlist({name: 'Most Played', trackIds: tracks});
}

function getRecentlyAdded(library) {
  return new Playlist({name: 'Recently Added', trackIds:  []});
}

function getRecentlyPlayed(library) {
  return new Playlist({name: 'Recently Played', trackIds: []});
}

function getLikesByYear(library) {
  return [new Playlist({name: "Favorite Songs 2019", trackIds: []})];
}

function getAutoPlaylists(library) {
  return [
    getMostPlayed(library),
    getUnlistened(library),
    getRecentlyAdded(library),
    getRecentlyPlayed(library),
    ...getLikesByYear(library),
  ];
}

export default class PlaylistPicker extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      playlists: this.props.library.getPlaylists(),
      autoPlaylists: getAutoPlaylists(this.props.library)
    };
  }
  
  // todo: make wrappedGrids items actually work and get rid of this
  autoCellRenderer(index, key, style) {
    const playlist = this.state.autoPlaylists[index];
    if (!playlist) {
      return (
        <div key={key} style={style} />
      );
    }
    const newStyle = {
      ...style,
      paddingLeft: (style.width - 150) / 2,
      paddingRight: (style.width - 150) / 2,
      width: 150
    };
    return (
      <div onClick={() => this.props.goToPlaylist(playlist)}
        key={key} style={newStyle} >
        {playlist.name}
      </div>
    );
  }

  cellRenderer(index, key, style) {
    const playlist = this.state.playlists[index];
    if (!playlist) {
      return (
        <div key={key} style={style} />
      );
    }
    const newStyle = {
      ...style,
      paddingLeft: (style.width - 150) / 2,
      paddingRight: (style.width - 150) / 2,
      width: 150
    };
    return (
      <div onClick={() => this.props.goToPlaylist(playlist)}
        key={key} style={newStyle} >
        {playlist.name}
      </div>
    );
  }

  render() {
    // todo: make auto different -- top heard, unheard, move errors to herei
    // instead of a filter, etc.
    return (
      <div className="main">
        <div style={{position: 'absolute', height: '100%', width: '100%'}}>
          <div style={{height: '100%', width: '50%'}}>
            Manual
            <WrappedGrid
              items={this.state.playlists}
              cellRenderer={this.cellRenderer.bind(this)}
            />
          </div>
          <div
            style={{
              height: '100%',
              position: 'absolute',
              top: 0,
              right: 0,
              width: '50%'
            }}>
            <span style={{width: '100%', textAlign: 'center'}}>Auto</span>
            <WrappedGrid
              items={this.state.autoPlaylists}
              cellRenderer={this.autoCellRenderer.bind(this)}
            />
          </div>
        </div>
      </div>
    );
  }
}
