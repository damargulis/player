import {musicBrainzUrl} from './extensions/musicbrainz/api';
import {shell} from 'electron';
import React from 'react';

interface OwnProps {
  mbid?: string;
  entityType: 'release-group' | 'artist';
}

type MusicBrainzLabelProps = OwnProps;

export default class MusicBrainzLabel extends React.Component<MusicBrainzLabelProps> {
  render(): JSX.Element {
    return (
      <div>
        <label>MusicBrainz: </label>
        <span className="link" onClick={() => this.openMusicBrainz()}>{this.getUrl()}</span>
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
