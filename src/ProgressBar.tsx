import {setTime} from "./redux/actions";
import React from "react";
import {connect} from "react-redux";
import {getTime} from "./redux/selectors";
import {getCurrentTrack} from "./redux/selectors";
import {RootState} from "./redux/store";
import {toTime} from "./utils";

import "./ProgressBar.css";

interface StateProps {
  time: number;
  duration: number;
}

interface DispatchProps {
  setTime(time: number): void;
}

type ProgressBarProps = StateProps & DispatchProps;

class ProgressBar extends React.Component<ProgressBarProps> {

  public render(): JSX.Element {
    return (
      <div className="progress-container">
        <span>{toTime(this.props.time * 1000)}</span>
        <input
          max={this.props.duration}
          min={0}
          onChange={this.onChange.bind(this)}
          type="range"
          value={this.props.time * 1000}
        />
        <span>{toTime(this.props.duration)}</span>
      </div>
    );
  }

  private onChange(evt: React.ChangeEvent<HTMLInputElement>): void {
    this.props.setTime(parseFloat(evt.target.value) / 1000);
  }
}

function mapStateToProps(state: RootState): StateProps {
  const track = getCurrentTrack(state);
  return {
    duration: track ? track.duration : 0,
    time: getTime(state),
  };
}

export default connect(mapStateToProps, {setTime})(ProgressBar);
