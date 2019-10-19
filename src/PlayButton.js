import React from 'react';

export default class PlayButton extends React.Component {
  onClick() {
    this.props.onClick();
  }

  render() {
    return (
          <button onClick={this.onClick.bind(this)} className="control-button">{this.props.playing ? 'Pause' : 'Play'} </button>
    )
  }
}
