import RandomSongPlaylist from './playlist/RandomSongPlaylist';
import React from 'react';
import {toTime} from './utils';
import {AutoSizer, Column, Table} from 'react-virtualized';

import 'react-virtualized/styles.css';

export default class SongPicker extends React.Component {
  constructor(props) {
    super(props);

    const sortDirection = 'ASC';
    const sortBy = 'name';
    const songs = this.sortSongs(sortBy, sortDirection);

    this.state = {
      sortBy: sortBy,
      songs: songs,
      // TODO: change to a set
      selected: [],
      lastSelected: null,
      sortDirection: sortDirection,
    }
  }

  sortSongs(sortBy, sortDirection) {
    let songs = this.props.songs.slice();
    switch (sortBy) {
      case 'name':
        songs = songs.sort((song1, song2) => {
          return song1.name.localeCompare(song2.name);
        });
        break;
      case 'duration':
        songs = songs.sort((song1, song2) => {
          return song1.duration - song2.duration;
        });
        break;
      case 'year':
        songs = songs.sort((song1, song2) => {
          return song1.year - song2.year;
        });
        break;
      case 'playCount':
        songs = songs.sort((song1, song2) => {
          return song1.playCount - song2.playCount;
        });
        break;
      case 'artists':
        songs = songs.sort((song1, song2) => {
          const artists1 = this.props.library.getArtistsByIds(song1.artistIds)
            .map(artist => artist.name).join(', ');
          const artists2 = this.props.library.getArtistsByIds(song2.artistIds)
            .map(artist => artist.name).join(', ');
          return artists1.localeCompare(artists2);
        });
        break;
      case 'albums':
        songs = songs.sort((song1, song2) => {
          const albums1 = this.props.library.getAlbumsByIds(song1.albumIds)
            .map(album => album.name).join(', ');
          const albums2 = this.props.library.getAlbumsByIds(song2.albumIds)
            .map(album => album.name).join(', ');
          return albums1.localeCompare(albums2);
        });
        break;
      case 'genres':
        songs = songs.sort((song1, song2) => {
          const genres1 = this.props.library.getGenresByIds(song1.genreIds)
            .join(', ');
          const genres2 = this.props.library.getGenresByIds(song2.genreIds)
            .join(', ');
          return genres1.localeCompare(genres2);
        });
        break;
      default:
        break;
    }
    if (sortDirection === 'DESC') {
      songs = songs.reverse();
    }
    return songs;
  }

  getSongData(index) {
    const song = this.state.songs[index];
    // TODO: make album (maybe artist?) rotate
    return {
      name: song.name,
      artists: this.props.library.getArtistsByIds(song.artistIds)
        .map(artist => artist.name).join(', '),
      albums: this.props.library.getAlbumsByIds(song.albumIds)
        .map(album => album.name).join(", "),
      genres: this.props.library.getGenresByIds(song.genreIds).join(", "),
      year: song.year,
      duration: toTime(song.duration),
      playCount: song.playCount,
    }
  }

  getRowStyle({index}) {
    const style = {};
    style.borderTop = 'solid black 1px';
    style.backgroundColor = index % 2 === 0 ? 'white' : 'lightgray';
    style.userSelect = 'none';
    if (index === -1) {
      style.backgroundColor = 'gray';
    }
    if (this.state.selected.includes(index)) {
      style.backgroundColor = 'blue';
    }
    return style;
  }

  doShiftClick(index) {
    if (this.state.lastSelected == null) {
      this.doClickSong(index);
      return;
    }
    let selected = this.state.selected;
    const min = Math.min(index, this.state.lastSelected);
    const max = Math.max(index, this.state.lastSelected);
    for (let ind = min; ind <= max; ind++) {
      if (!selected.includes(ind)) {
        selected.push(ind);
      }
    }
    this.setState({selected});
  }

  doCmdClick(index) {
    let selected = this.state.selected;
    if (selected.includes(index)) {
      selected = selected.filter((ind) => ind !== index);
    } else {
      selected.push(index);
    }
    this.setState({
      lastSelected: index,
      selected: selected
    });
  }

  onRowClick({event, index}) {
    if (event.shiftKey) {
      this.doShiftClick(index);
    } else if (event.metaKey || event.ctrlKey) {
      this.doCmdClick(index);
    } else {
      this.doClickSong(index);
    }
  }

  onRowDoubleClick({event, index}) {
    if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
      this.doDoubleClickSong(index);
    }
  }

  doClickSong(index) {
    this.setState({
      selected: [index],
      lastSelected: index,
    });
  }

  doDoubleClickSong(index) {
    const song = this.state.songs[index];
    const playlist = new RandomSongPlaylist(this.state.songs);
    playlist.addSong(song);
    this.props.setPlaylistAndPlay(playlist);
  }

  sort({defaultSortDirection, event, sortBy, sortDirection}) {
    const songs = this.sortSongs(sortBy, sortDirection);
    const selectedNow = this.state.selected.map((index) => {
      return this.state.songs[index];
    });
    const selected = selectedNow.map((song) => {
      return songs.indexOf(song);
    });
    this.setState({sortBy, sortDirection, songs, selected});
  }

  render() {
    return (
      <div className="main">
        <AutoSizer>
          {({height, width}) => {
            return (
              <Table
                headerHeight={30}
                height={height}
                rowCount={this.state.songs.length}
                rowGetter={({index}) => this.getSongData(index)}
                rowHeight={20}
                width={width}
                rowStyle={this.getRowStyle.bind(this)}
                onRowClick={this.onRowClick.bind(this)}
                onRowDoubleClick={this.onRowDoubleClick.bind(this)}
                sortBy={this.state.sortBy}
                sort={this.sort.bind(this)}
                sortDirection={this.state.sortDirection}
                rowClassName="songRow"
              >
                <Column
                  label="Name"
                  width={300}
                  dataKey="name"
                />
                <Column
                  label="Time"
                  width={50}
                  dataKey="duration"
                />
                <Column
                  label="Artists"
                  width={150}
                  dataKey="artists"
                />
                <Column
                  label="Albums"
                  width={150}
                  dataKey="albums"
                />
                <Column
                  label="Genres"
                  width={100}
                  dataKey="genres"
                />
                <Column
                  label="Year"
                  width={50}
                  dataKey="year"
                />
                <Column
                  label="Plays"
                  width={80}
                  dataKey="playCount"
                />
              </Table>
            )
          }}
        </AutoSizer>
      </div>
    )
  }
}
