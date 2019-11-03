import React from 'react';

export default class PlaylistTypePicker extends React.Component {
  onChange() {
  }

  render() {
    return (
      <div id="playlist-picker">
        <select onChange={this.onChange.bind(this)} size={4}
          style={{width: '80%', height: '80%', margin: '10%'}}>
          <option onClick={() => this.props.setType('album')}
            style={{padding: '5px'}}>Albums</option>
          <option onClick={() => this.props.setType('artist')}
            style={{padding: '5px'}}>Artists</option>
          <option onClick={() => this.props.setType('song')}
            style={{padding: '5px'}}>Songs</option>
          <option onClick={() => this.props.setType('playlist')}
            style={{padding: '5px'}}>Playlists</option>
        </select>
      </div>
    )
  }
}

