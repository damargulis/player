import {saveNewTracks} from './redux/actions';
import {Track} from './redux/actionTypes';
import './NewTracksPage.css';
import React from 'react';
import {connect} from 'react-redux';
import {albumTarget, artistTarget, describeTargets, runAllForTargets} from './extensions/runAll';
import RunExtensionsButton from './RunExtensionsButton';
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

/** Distinct ids in the order the tracks mention them, so the first album listed runs first. */
function distinct(tracks: Track[], pick: (track: Track) => string[]): string[] {
  const seen: string[] = [];
  tracks.forEach((track) => pick(track).forEach((id) => {
    if (id && seen.indexOf(id) < 0) {
      seen.push(id);
    }
  }));
  return seen;
}

class NewTracksPage extends React.Component<NewTracksPageProps> {

  public render(): JSX.Element {
    const albumIds = distinct(this.props.newTracks, (track) => track.albumIds || []);
    const artistIds = distinct(this.props.newTracks, (track) => track.artistIds || []);
    const targets = albumIds.map(albumTarget).concat(artistIds.map(artistTarget));
    return (
      <div className="main">
        <h2 className="pageTitle">New Songs:</h2>
        <button onClick={() => this.saveAll()} className="saveButton">Save All</button>
        {/*
          * Running from here is the point: the album already exists the moment the files are
          * dropped — UPLOAD_FILES finds or creates it and attaches the tracks, and Save All
          * only clears this list — so the alternative was leaving the page to search for the
          * album, or playing one of its songs to reach it through the player.
          */}
        <span className="newTracksRun">
          <RunExtensionsButton
            describe={describeTargets(targets)}
            ids={targets}
            noun="album"
            run={runAllForTargets}
          />
        </span>
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
