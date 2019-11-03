import React from 'react';
import WrappedGrid from './WrappedGrid';

export default class PlaylistPicker extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      playlists: this.props.library.getPlaylists(),
    }
  }

  cellRenderer(index, key, style) {
    const playlist = this.state.playlists[index];
    if (!playlist) {
      return (
        <div key={key} style={style} />
      )
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
    return (
      <div className="main">
        <WrappedGrid
          items={this.state.playlists}
          cellRenderer={this.cellRenderer.bind(this)}
        />
      </div>
    )
  }
}
