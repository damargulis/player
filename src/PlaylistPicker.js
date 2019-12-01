import React from 'react';
import WrappedGrid from './WrappedGrid';

export default class PlaylistPicker extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      playlists: this.props.library.getPlaylists(),
    };
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
          <div style={{height: '100%', position: 'absolute', top: 0, right: 0, width: '50%'}}>
            <span style={{width: '100%', textAlign: 'center'}}>Auto</span>
            <WrappedGrid
              items={this.state.playlists}
              cellRenderer={this.cellRenderer.bind(this)}
            />
          </div>
        </div>
      </div>
    );
  }
}
