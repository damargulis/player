import React from 'react';

import {AutoSizer, Column, Table} from 'react-virtualized';
import 'react-virtualized/styles.css';

function toTime(ms) {
  const total_seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(total_seconds / 60);
  let seconds = total_seconds % 60;
  if (seconds < 10) {
    seconds = '0' + seconds;
  }
  return `${minutes}:${seconds}`;
}

export default class SongPicker extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      sortMethod: null,
      reverse: false,
      sortedSongs: this.sortSongs(this.props.songs),
      selected: [],
    }

  }

  componentDidUpdate() {
    const sortedSongs = this.sortSongs(this.props.songs);
    if (sortedSongs.length !== this.state.sortedSongs.length || sortedSongs.some((song, index) => {
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
      artists: this.props.library.getArtistsByIds(song.artistIds).map(artist => artist.name).join(', '),
      albums: this.props.library.getAlbumsByIds(song.albumIds).map(album => album.name).join(", "),
      genres: this.props.library.getGenresByIds(song.genreIds).join(", "),
      year: song.year,
      duration: toTime(song.duration),
    }
  }

  getRowStyle(index) {
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
    console.log('do shift click');
    console.log(index);
  }

  doCmdClick(index) {
    console.log('do cmd click');
    let selected = this.state.selected;
    if (selected.includes(index)) {
      selected = selected.filter((i) => i !== index);
    } else {
      selected.push(index);
    }
    console.log('setting state');
    this.setState({selected});
  }

  onRowClick(evt, index, rowData) {
    console.log('on row click');
    if (evt.shiftKey) {
      this.doShiftClick(index);
    } else if (evt.metaKey || evt.ctrlKey) {
      this.doCmdClick(index);
    } else {
      this.doClickSong(index);
    }
  }

  onRowDoubleClick(evt, index, rowData) {
    if (!evt.shiftKey && !evt.ctrlKey && !evt.metaKey) {
      this.doDoubleClickSong(index);
    }
  }

  doClickSong(index) {
    this.setState({
      selected: [index],
    });
  }

  doDoubleClickSong(index) {
    console.log('do double click');
    console.log(index);
    const song = this.state.sortedSongs[index];
    this.props.playSong(song);
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
              rowStyle={({index}) => this.getRowStyle(index)}
              onRowClick={({event, index, rowData}) => this.onRowClick(event, index, rowData)}
              onRowDoubleClick={({event, index, rowData}) => this.onRowDoubleClick(event, index, rowData)}
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
            </Table>
        )
      }}
        </AutoSizer>
      </div>
    )
  }
}
