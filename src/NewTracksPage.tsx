import {Track} from './redux/actionTypes';
import React from 'react';
import {connect} from 'react-redux';
import {getNewFiles, getNewTracks} from './redux/selectors';
import {RootState} from './redux/store';
import TrackPicker from './TrackPicker';
import "./NewTracksPage.css";

interface StateProps {
  newFiles: File[];
  newTracks: Track[];
}

type NewTracksPageProps = StateProps;

class NewTracksPage extends React.Component<StateProps> {
  private saveAll(): void {
    console.log("save all");
    console.log(this.props);
    console.log(this.state);
  }

  public render(): JSX.Element {
    console.log(this.props.newFiles);
    return (
      <div className="main">
        <h2 className="pageTitle">New Songs:</h2>
        <button onClick={this.saveAll.bind(this)} className="saveButton">Save All</button>
        <TrackPicker tracks={this.props.newTracks} />
      </div>
    );
  }
}

function mapStateToProps(state: RootState): StateProps {
  return {
    newFiles: getNewFiles(state),
    newTracks: getNewTracks(state),
  };
}

export default connect(mapStateToProps)(NewTracksPage);
