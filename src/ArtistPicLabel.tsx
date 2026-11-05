import {Artist} from './redux/actionTypes';
import {imageSize} from './extensions/imageSize';
import React from 'react';

interface OwnProps {
  artist: Artist;
}

interface State {
  size?: {width: number; height: number};
}

/**
 * The artist picture's resolution.
 *
 * The same reasoning as the album's cover-art row: the page renders a 100px thumbnail, so
 * there is no telling a tiny picture from a good one, and 208 artists here have none at all.
 * There is no per-row Run button because nothing fetches artist pictures on its own — they
 * come from the MusicBrainz and Wikipedia runs, which already have theirs.
 */
export default class ArtistPicLabel extends React.Component<OwnProps, State> {
  constructor(props: OwnProps) {
    super(props);
    this.state = {};
  }

  public componentDidMount(): void {
    this.measure();
  }

  public componentDidUpdate(prev: OwnProps): void {
    if (prev.artist.artFile !== this.props.artist.artFile) {
      this.measure();
    }
  }

  public render(): JSX.Element {
    return (
      <div className="metaRow">
        <label>Picture: </label>
        <span className="metaValue">{this.describe()}</span>
      </div>
    );
  }

  private describe(): string {
    if (!this.props.artist.artFile) {
      return 'none';
    }
    const {size} = this.state;
    return size ? `${size.width} × ${size.height}` : 'unreadable';
  }

  /** Measured off the file, never in render: this page re-renders on every redux action. */
  private measure(): void {
    const file = this.props.artist.artFile;
    this.setState({size: file ? imageSize(file) : undefined});
  }
}
