import {musicBrainzUrl} from './extensions/musicbrainz/api';
import {shell} from 'electron';
import React from 'react';

interface OwnProps {
  mbid?: string;
  entityType: 'release-group' | 'artist';
  /** When given, renders a small Run button inline with the field. */
  onRun?(): void;
}

type MusicBrainzLabelProps = OwnProps;

export default class MusicBrainzLabel extends React.Component<MusicBrainzLabelProps> {
  render(): JSX.Element {
    return (
      <div className="metaRow">
        <label>MusicBrainz: </label>
        <span className="link metaValue" onClick={() => this.openMusicBrainz()}>{this.getUrl()}</span>
        {this.props.onRun && (
          <button
            className="runExtension"
            onClick={this.props.onRun}
            title="Run the MusicBrainz extension for this item"
          >
            Run
          </button>
        )}
      </div>
    );
  }

  private getUrl(): string {
    return musicBrainzUrl(this.props.entityType, this.props.mbid);
  }

  private openMusicBrainz(): void {
    const url = this.getUrl();
    if (url) {
      shell.openExternal(url);
    }
  }
}
