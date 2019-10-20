import React from 'react';

import VirtualList from 'react-tiny-virtual-list';

export default class SongPicker extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      sortMethod: null,
      reverse: false,
      sortedSongs: this.sortSongs(this.props.songs),
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

  render() {
    return (
      <div className="main">
        <VirtualList
          width='100%'
          height={500}
          itemCount={this.state.sortedSongs.length}
          itemSize={20}
          renderItem={({index, style}) =>
            <option key={index} style={style}>
            {this.state.sortedSongs[index].name}
            </option>
          }
        />
      </div>
    )
  }
}
