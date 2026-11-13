import {musicBrainzUrl} from './extensions/musicbrainz/api';
import MetaRow from './MetaRow';
import React from 'react';

interface OwnProps {
  mbid?: string;
  entityType: 'release-group' | 'artist';
  /**
   * When given, renders a small Run button inline with the field.
   *
   * Return the promise: `MetaRow` then shows a pending state and puts a failure beside the row.
   * These two used to take a plain `void` and the callers dropped the promise, so a failed run
   * was entirely silent and the button never looked busy.
   */
  onRun?(): void | PromiseLike<void>;
}

export default class MusicBrainzLabel extends React.Component<OwnProps> {
  public render(): JSX.Element {
    const url = musicBrainzUrl(this.props.entityType, this.props.mbid);
    return (
      <MetaRow
        label="MusicBrainz"
        link={url}
        onRun={this.props.onRun}
        runTitle="Run the MusicBrainz extension for this item"
        value={url}
      />
    );
  }
}
