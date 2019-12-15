import PropTypes from 'prop-types';
import React from 'react';
import Track from './library/Track';

import {toTime} from './utils';

export default class ProgressBar extends React.Component {
  onChange(evt) {
    this.props.setTime(evt.target.value);
  }

  render() {
    const totalDuration = this.props.track ? this.props.track.duration : 0;
    return (
      <div>
        <span>{toTime(this.props.time * 1000)}</span>
        <input
          max={totalDuration}
          min={0}
          onChange={this.onChange.bind(this)}
          type="range"
          value={this.props.time * 1000}
        />
        <span>{toTime(totalDuration)}</span>
      </div>
    );
  }
}

ProgressBar.propTypes = {
  setTime: PropTypes.func.isRequired,
  time: PropTypes.number.isRequired,
  track: PropTypes.instanceOf(Track),
};
