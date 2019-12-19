import EmptyPlaylist from './playlist/EmptyPlaylist';
import Library from './library/Library';
import Playlist from './library/Playlist';
import React from 'react';
import WrappedGrid from './WrappedGrid';

const THREE_MONTHS = 1000 * 60 * 60 * 24;

/**
 * Gets the unlistened songs in the library.
 */
function getUnlistened(library: Library) {
  const tracks = library.getTracks().filter((track) => {
    return track.playCount === 0;
  }).map((track) => {
    return track.id;
  });
  return new Playlist({name: "Unheard", trackIds: tracks});
}

/**
 * Gets the 100 most played songs in the library.
 */
function getMostPlayed(library: Library) {
  const tracks = library.getTracks().slice().sort((track1, track2) => {
    return track2.playCount - track1.playCount;
  }).slice(0, 100).map((track) => {
    return track.id;
  });
  return new Playlist({name: 'Most Played', trackIds: tracks});
}

/**
 * Gets the songs added to the library in the last 3 months.
 */
function getRecentlyAdded(library: Library) {
  const now = new Date().getTime();
  const tracks = library.getTracks().filter((track) => {
    return now - track.dateAdded.getTime() < THREE_MONTHS;
  }).map((track) => {
    return track.id;
  });
  return new Playlist({name: 'Recently Added', trackIds: tracks});
}

/**
 * Gets the songs listened to in the last 3 months.
 */
function getRecentlyPlayed(library: Library) {
  const now = new Date().getTime();
  const tracks = library.getTracks().filter((track) => {
    return now - track.playDate.getTime() < THREE_MONTHS;
  }).map((track) => {
    return track.id;
  });
  return new Playlist({name: 'Recently Played', trackIds: tracks});
}

/**
 * Gets playlist for likes in a given year.
 */
function getLikesForYear(library: Library, year: number) {
  const tracks = library.getTracks().filter((track) => {
    return track.favorites.indexOf(year) !== -1;
  }).map((track) => {
    return track.id;
  });
  return new Playlist({name: 'Favorite Tracks of ' + year, trackIds: tracks});
}

/**
 * Gets a playlist of songs liked in each year.
 */
function getLikesByYear(library: Library) {
  const years = new Set<number>();
  library.getTracks().forEach((track) => {
    track.favorites.forEach((year) => years.add(year));
  });
  return [...years].map((year) => {
    return getLikesForYear(library, year);
  });
}

/**
 * Gets playlist for album likes in a given year.
 */
function getAlbumLikesForYear(library: Library, year: number) {
  const tracks = library.getAlbums().filter((album) => {
    return album.favorites.indexOf(year) !== -1;
  }).map((album) => {
    return album.trackIds;
  }).flat();
  return new Playlist({name: 'Favorite Albums of ' + year, trackIds: tracks});
}

/**
 * Gets a playlist of albums liked in each year.
 */
function getAlbumLikesByYear(library: Library) {
  const years = new Set<number>();
  library.getAlbums().forEach((album) => {
    album.favorites.forEach((year) => years.add(year));
  });
  return [...years].map((year) => {
    return getAlbumLikesForYear(library, year);
  });
}

/**
 * Gets all auto playlists.
 */
function getAutoPlaylists(library: Library) {
  return [
    getMostPlayed(library),
    getUnlistened(library),
    getRecentlyAdded(library),
    getRecentlyPlayed(library),
    ...getLikesByYear(library),
    ...getAlbumLikesByYear(library),
  ];
}

interface PlaylistPickerProps {
  goToPlaylist: (playlist: Playlist) => void;
  library: Library;
  setPlaylistAndPlay: (playlist: EmptyPlaylist) => void;
}

interface PlaylistPickerState {
  autoPlaylists: Playlist[];
  playlists: Playlist[];
}

export default class PlaylistPicker extends React.Component<PlaylistPickerProps,PlaylistPickerState> {
  constructor(props: PlaylistPickerProps) {
    super(props);
    this.state = {
      playlists: this.props.library.getPlaylists(),
      autoPlaylists: getAutoPlaylists(this.props.library)
    };
  }

  renderPlaylist(index: number, key: string, style: {width: number}, playlist: Playlist) {
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
      <div key={key}
        onClick={() => this.props.goToPlaylist(playlist)} style={newStyle}
      >
        {playlist.name}
      </div>
    );
  }

  // todo: make wrappedGrids items actually work and get rid of this
  autoCellRenderer(index: number, key: string, style: {width: number}) {
    const playlist = this.state.autoPlaylists[index];
    return this.renderPlaylist(index, key, style, playlist);
  }

  // for regular playlists
  cellRenderer(index: number, key: string, style: {width: number}) {
    const playlist = this.state.playlists[index];
    return this.renderPlaylist(index, key, style, playlist);
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
              cellRenderer={this.cellRenderer.bind(this)}
              numItems={this.state.playlists.length}
            />
          </div>
          <div
            style={{
              height: '100%',
              position: 'absolute',
              top: 0,
              right: 0,
              width: '50%'
            }}
          >
            <span style={{width: '100%', textAlign: 'center'}}>Auto</span>
            <WrappedGrid
              cellRenderer={this.autoCellRenderer.bind(this)}
              numItems={this.state.autoPlaylists.length}
            />
          </div>
        </div>
      </div>
    );
  }
}
