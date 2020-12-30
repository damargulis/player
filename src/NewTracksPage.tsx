import {saveNewTracks} from './redux/actions';
import {Track} from './redux/actionTypes';
import './NewTracksPage.css';
import React from 'react';
import {connect} from 'react-redux';
import {getNewTracks} from './redux/selectors';
import {RootState} from './redux/store';
import TrackPicker from './TrackPicker';

interface StateProps {
  newTracks: Track[];
}

interface DispatchProps {
  saveNewTracks(): void;
}

type NewTracksPageProps = StateProps & DispatchProps;

class NewTracksPage extends React.Component<NewTracksPageProps> {

  public render(): JSX.Element {
    return (
      <div className="main">
        <h2 className="pageTitle">New Songs:</h2>
        <button onClick={() => this.saveAll()} className="saveButton">Save All</button>
        <TrackPicker tracks={this.props.newTracks} />
      </div>
    );
  }
  private saveAll(): void {
    this.props.saveNewTracks();
  }
}

function mapStateToProps(state: RootState): StateProps {
  return {
    newTracks: getNewTracks(state),
  };
}

export default connect(mapStateToProps, {saveNewTracks})(NewTracksPage);
