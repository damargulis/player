import RandomSongPlaylist from './playlist/RandomSongPlaylist';
import React from 'react';
import util from './utils';
import {AutoSizer, Column, Table} from 'react-virtualized';

import 'react-virtualized/styles.css';

export default class SongPicker extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      sortMethod: null,
      reverse: false,
      sortedSongs: this.sortSongs(this.props.songs),
      // TODO: change to a set
      selected: [],
      lastSelected: null,
    }

  }

  componentDidUpdate() {
    const sortedSongs = this.sortSongs(this.props.songs);
    if (sortedSongs.length !== this.state.sortedSongs.length ||
      sortedSongs.some((song, index) => {
        return this.state.sortedSongs[index] !== song;
      })) {
      const selectedNow = this.state.selected.map((index) => {
        return this.state.sortedSongs[index];
      });
      const selectedNext = selectedNow.map((song) => {
        return sortedSongs.indexOf(song);
      });
      this.setState({
        sortedSongs: sortedSongs,
        selected: selectedNext,
      });
    }
  }

  sortSongs(songs) {
    if (this.state && this.state.sortMethod) {
      return songs.slice().sort((song1, song2) => {
        if (this.state.reverse) {
          return this.state.sortMethod(song2, song1);
        }
        return this.state.sortMethod(song1, song2);
      });
    }
    return songs.slice().sort((song1, song2) => {
      return song1.name.localeCompare(song2.name);
    });
  }

  getSongData(index) {
    const song = this.state.sortedSongs[index];
    // TODO: make album (maybe artist?) rotate
    return {
      name: song.name,
      artists: this.props.library.getArtistsByIds(song.artistIds)
        .map(artist => artist.name).join(', '),
      albums: this.props.library.getAlbumsByIds(song.albumIds)
        .map(album => album.name).join(", "),
      genres: this.props.library.getGenresByIds(song.genreIds).join(", "),
      year: song.year,
      duration: util.toTime(song.duration),
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
    this.setState({selected});
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
    const song = this.state.sortedSongs[index];
    const playlist = new RandomSongPlaylist(this.state.sortedSongs);
    playlist.addSong(song);
    this.props.setPlaylistAndPlay(playlist);
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
                rowCount={this.state.sortedSongs.length}
                rowGetter={({index}) => this.getSongData(index)}
                rowHeight={20}
                width={width}
                rowStyle={this.getRowStyle.bind(this)}
                onRowClick={this.onRowClick.bind(this)}
                onRowDoubleClick={this.onRowDoubleClick.bind(this)}
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
