import Playlist from './library/Playlist';
import React from 'react';
import WrappedGrid from './WrappedGrid';

/**
 * Miliseconds in 3 months
 * @type {number}
 */
const THREE_MONTHS = 1000 * 60 * 60 * 24;

/**
 * Gets the unlistened songs in the library.
 * @param {!Libary} library The library to get from.
 * @return {!Playlist} The playlist.
 */
function getUnlistened(library) {
  const tracks = library.getTracks().filter((track) => {
    return track.playCount === 0;
  }).map((track) => {
    return track.id;
  });
  return new Playlist({name: "Unheard", trackIds: tracks});
}

/**
 * Gets the 100 most played songs in the library.
 * @param {!Libary} library The library to get from.
 * @return {!Playlist} The playlist.
 */
function getMostPlayed(library) {
  const tracks = library.getTracks().slice().sort((track1, track2) => {
    return track2.playCount - track1.playCount;
  }).slice(0, 100).map((track) => {
    return track.id;
  });
  return new Playlist({name: 'Most Played', trackIds: tracks});
}

/**
 * Gets the songs added to the library in the last 3 months.
 * @param {!Libary} library The library to get from.
 * @return {!Playlist} The playlist.
 */
function getRecentlyAdded(library) {
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
 * @param {!Libary} library The library to get from.
 * @return {!Playlist} The playlist.
 */
function getRecentlyPlayed(library) {
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
 * @param {!Library} library The library to get from.
 * @param {number} year The year to get favorites for.
 * @return {!Playlist} The playlist.
 */
function getLikesForYear(library, year) {
  const tracks = library.getTracks().filter((track) => {
    return track.favorites.indexOf(year) !== -1;
  }).map((track) => {
    return track.id;
  });
  return new Playlist({name: 'Favorite Tracks of ' + year, trackIds: tracks});
}

/**
 * Gets a playlist of songs liked in each year.
 * @param {!Libary} library The library to get from.
 * @return {!Array<!Playlist>} The playlists.
 */
function getLikesByYear(library) {
  const years = new Set();
  library.getTracks().forEach((track) => {
    track.favorites.forEach((year) => years.add(year));
  });
  return [...years].map((year) => {
    return getLikesForYear(library, year);
  });
}

/**
 * Gets playlist for album likes in a given year.
 * @param {!Library} library The library to get from.
 * @param {number} year The year to get favorites for.
 * @return {!Playlist} The playlist.
 */
function getAlbumLikesForYear(library, year) {
  const tracks = library.getAlbums().filter((album) => {
    return album.favorites.indexOf(year) !== -1;
  }).map((album) => {
    return album.trackIds;
  }).flat();
  return new Playlist({name: 'Favorite Albums of ' + year, trackIds: tracks});
}

/**
 * Gets a playlist of albums liked in each year.
 * @param {!Libary} library The library to get from.
 * @return {!Array<!Playlist>} The playlists.
 */
function getAlbumLikesByYear(library) {
  const years = new Set();
  library.getAlbums().forEach((album) => {
    album.favorites.forEach((year) => years.add(year));
  });
  return [...years].map((year) => {
    return getAlbumLikesForYear(library, year);
  });
}

/**
 * Gets all auto playlists.
 * @param {!Library} library The library to get from.
 * @return {!Array<!Playlist>} The playlists.
 */
function getAutoPlaylists(library) {
  return [
    getMostPlayed(library),
    getUnlistened(library),
    getRecentlyAdded(library),
    getRecentlyPlayed(library),
    ...getLikesByYear(library),
    ...getAlbumLikesByYear(library),
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
