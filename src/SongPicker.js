import Library from './library/Library';
import Modal from 'react-modal';
import PropTypes from 'prop-types';
import RandomSongPlaylist from './playlist/RandomSongPlaylist';
import React from 'react';
import SearchBar from './SearchBar';
import SongEditer from './SongEditer';
import {toTime} from './utils';
import {AutoSizer, Column, Table} from 'react-virtualized';

import 'react-virtualized/styles.css';


// see: http://reactcommunity.org/react-modal/accessibility/#app-element
Modal.setAppElement('#root');

const {remote} = require('electron');
const {Menu, MenuItem} = remote;

export default class SongPicker extends React.Component {
  constructor(props) {
    super(props);

    const sortDirection = 'ASC';
    const sortBy = this.props.sortBy || 'name';
    const songs = this.sortSongs(sortBy, sortDirection);

    this.state = {
      sortBy,
      songs,
      // TODO: change to a set
      selected: [],
      lastSelected: null,
      sortDirection,
      search: '',
      editing: false,
    };
  }

  componentDidMount() {
    this.sort(this.state);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.songs !== this.props.songs) {
      this.sort(this.state);
    }
  }

  sortSongs(sortBy, sortDirection) {
    let songs = this.props.songs.slice().filter((song) => {
      if (this.state && this.state.search) {
        return song.name.toLowerCase()
          .includes(this.state.search.toLowerCase());
      }
      return true;
    });
    switch (sortBy) {
    case 'index':
      break;
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
      index: this.props.songs.indexOf(song) + 1,
      name: song.name,
      artists: this.props.library.getArtistsByIds(song.artistIds)
        .map(artist => artist.name).join(', '),
      albums: this.props.library.getAlbumsByIds(song.albumIds)
        .map(album => album.name).join(", "),
      genres: this.props.library.getGenresByIds(song.genreIds).join(", "),
      year: song.year,
      duration: toTime(song.duration),
      playCount: song.playCount,
    };
  }

  getRowStyle({index}) {
    const style = {};
    style.borderTop = 'solid black 1px';
    style.backgroundColor = index % 2 === 0 ? 'white' : 'lightgray';
    style.userSelect = 'none';
    style.fontSize = 10;
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
    const selected = this.state.selected;
    const min = Math.min(index, this.state.lastSelected);
    const max = Math.max(index, this.state.lastSelected);
    for (let ind = min; ind <= max; ind++) {
      if (!selected.includes(ind)) {
        selected.push(ind);
      }
    }
    this.setState({selected});
  }

  edit() {
    this.setState({editing: true});
  }

  doRowRightClick({index}) {
    if (!this.state.selected.includes(index)) {
      this.setState({selected: [index], lastSelected: index});
    }
    const menu = new Menu();
    menu.append(
      new MenuItem({label: 'Edit Info', click: this.edit.bind(this)}));
    menu.append(new MenuItem({label: 'Play Next'}));
    menu.append(new MenuItem({label: 'Favorite'}));
    menu.popup({window: remote.getCurrentWindow()});
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
      selected
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

  sort({sortBy, sortDirection}) {
    const songs = this.sortSongs(sortBy, sortDirection);
    const selectedNow = this.state.selected.map((index) => {
      return this.state.songs[index];
    });
    const selected = selectedNow.map((song) => {
      return songs.indexOf(song);
    }).filter((num) => num >= 0);
    this.setState({sortBy, sortDirection, songs, selected});
  }

  onSearch(search) {
    this.setState({search}, () => this.sort(this.state));
  }

  closeEdit() {
    this.setState({editing: false});
  }

  render() {
    // do this by id or something instead, this kind of check is bad but needed
    // because object gets serialized from miniwindow -> maxwindow
    const scrollTo = this.props.scrollToSong
      ? this.state.songs.findIndex((song) => {
        return song.id === this.props.scrollToSong.id;
      })
      : -1;
    const selectedSongs = this.state.selected.map((songId) => {
      return this.state.songs[songId];
    });
    return (
      <div className="main">
        <Modal isOpen={this.state.editing}
          onRequestClose={this.closeEdit.bind(this)}
        >
          <SongEditer
            exit={this.closeEdit.bind(this)}
            library={this.props.library}
            tracks={selectedSongs}
          />
        </Modal>
        <SearchBar onSearch={(search) => this.onSearch(search)} />
        <AutoSizer>
          {({height, width}) => {
            return (
              <Table
                headerHeight={30}
                height={height}
                onRowClick={this.onRowClick.bind(this)}
                onRowDoubleClick={this.onRowDoubleClick.bind(this)}
                onRowRightClick={this.doRowRightClick.bind(this)}
                rowClassName="songRow"
                rowCount={this.state.songs.length}
                rowGetter={({index}) => this.getSongData(index)}
                rowHeight={15}
                rowStyle={this.getRowStyle.bind(this)}
                scrollToIndex={scrollTo}
                sort={this.sort.bind(this)}
                sortBy={this.state.sortBy}
                sortDirection={this.state.sortDirection}
                width={width}
              >
                <Column
                  dataKey="index"
                  label="Index"
                  width={50}
                />
                <Column
                  dataKey="name"
                  label="Name"
                  width={300}
                />
                <Column
                  dataKey="duration"
                  label="Time"
                  width={50}
                />
                <Column
                  dataKey="artists"
                  label="Artists"
                  width={150}
                />
                <Column
                  dataKey="albums"
                  label="Albums"
                  width={150}
                />
                <Column
                  dataKey="genres"
                  label="Genres"
                  width={100}
                />
                <Column
                  dataKey="year"
                  label="Year"
                  width={50}
                />
                <Column
                  dataKey="playCount"
                  label="Plays"
                  width={80}
                />
              </Table>
            );
          }}
        </AutoSizer>
      </div>
    );
  }
}

SongPicker.propTypes = {
  library: PropTypes.instanceOf(Library).isRequired,
  scrollToSong: PropTypes.func.isRequired,
  setPlaylistAndPlay: PropTypes.func.isRequired,
  songs: PropTypes.array.isRequired,
  sortBy: PropTypes.string.isRequired,
};
