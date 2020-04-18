import {saveNewTracks} from './redux/actions';
import {Track} from './redux/actionTypes';
import React from 'react';
import {connect} from 'react-redux';
import {getNewTracks} from './redux/selectors';
import {RootState} from './redux/store';
import TrackPicker from './TrackPicker';
import "./NewTracksPage.css";

interface StateProps {
  newTracks: Track[];
}

interface DispatchProps {
  saveNewTracks(): void;
}

type NewTracksPageProps = StateProps & DispatchProps;

class NewTracksPage extends React.Component<NewTracksPageProps> {
  private saveAll(): void {
    console.log("save all");
    console.log(this.props);
    console.log(this.state);
    this.props.saveNewTracks();
  }

  public render(): JSX.Element {
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
    newTracks: getNewTracks(state),
  };
}

export default connect(mapStateToProps, {saveNewTracks})(NewTracksPage);
