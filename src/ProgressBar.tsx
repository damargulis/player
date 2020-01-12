import React from "react";
import { connect } from "react-redux";
import {getTime} from "./redux/selectors";
import {RootState} from "./redux/store";
import Track from "./library/Track";
import {toTime} from "./utils";

import "./ProgressBar.css";

interface ProgressBarProps {
  time: number;
  track?: Track;
  setTime(time: number): void;
}

class ProgressBar extends React.Component<ProgressBarProps> {

  public render(): JSX.Element {
    const totalDuration = this.props.track ? this.props.track.duration : 0;
    return (
      <div className="progress-container">
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

  private onChange(evt: React.ChangeEvent<HTMLInputElement>): void {
    this.props.setTime(parseFloat(evt.target.value));
  }
}

function mapStateToProps(state: RootState): {time: number} {
  return {
    time: getTime(state),
  };
}

export default connect(mapStateToProps)(ProgressBar);
