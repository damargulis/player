import React from 'react';
import Track from './library/Track';

import {toTime} from './utils';

interface ProgressBarProps {
  setTime: (time: number) => void;
  time: number;
  track?: Track;
}

export default class ProgressBar extends React.Component<ProgressBarProps,{}> {
  onChange(evt: React.ChangeEvent<HTMLInputElement>) {
    this.props.setTime(parseFloat(evt.target.value));
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
