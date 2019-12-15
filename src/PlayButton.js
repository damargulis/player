import PropTypes from 'prop-types';
import React from 'react';

export default class PlayButton extends React.Component {
  onClick() {
    this.props.onClick();
  }

  render() {
    return (
      <button className="control-button" onClick={this.onClick.bind(this)}>
        {this.props.playing ? 'Pause' : 'Play'}
      </button>
    );
  }
}

PlayButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  playing: PropTypes.bool.isRequired,
};
