import React from 'react';

import util from './utils';

export default class ProgressBar extends React.Component {
  onChange(evt) {
    this.props.setTime(evt.target.value);
  }

  render() {
    const totalDuration = this.props.track ? this.props.track.duration : 0;
    return (
      <div>
        <span>{util.toTime(this.props.time * 1000)}</span>
        <input onChange={this.onChange.bind(this)} type="range" value={this.props.time * 1000} min={0} max={totalDuration} />
        <span>{util.toTime(totalDuration)}</span>
      </div>
    )
  }
}
