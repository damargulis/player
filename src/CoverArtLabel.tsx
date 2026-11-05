import {Album} from './redux/actionTypes';
import {imageSize} from './extensions/imageSize';
import React from 'react';

interface OwnProps {
  album: Album;
  /** Runs the Cover Art extension for this album alone. */
  onRun(): Promise<void>;
}

interface State {
  size?: {width: number; height: number};
  running: boolean;
  message?: string;
}

/**
 * The album's cover-art resolution, with a button to fetch a better one.
 *
 * Showing the size is the point, not decoration: the page renders a 100px thumbnail, so there
 * is otherwise no way to tell a 220px cover from a 1200px one, and that is exactly what decides
 * whether running the extension is worth anything. 448 covers in this library are still under
 * 600px because the Archive has nothing bigger for them.
 *
 * `Album.coverArt` records what the Archive could supply, so when the file already matches it
 * the button says so rather than inviting a request that cannot improve anything.
 */
export default class CoverArtLabel extends React.Component<OwnProps, State> {
  constructor(props: OwnProps) {
    super(props);
    this.state = {running: false};
  }

  public componentDidMount(): void {
    this.measure();
  }

  /**
   * Re-measures when the art could have changed.
   *
   * The file is overwritten in place, so the path is not enough to notice a new cover — the
   * `coverArt` marker moving is the signal. Measuring in `render` instead would mean reading
   * the file on every redux action, since this page's `mapStateToProps` builds new closures
   * and so re-renders on all of them, `timeupdate` included.
   */
  public componentDidUpdate(prev: OwnProps): void {
    const before = prev.album;
    const now = this.props.album;
    const marker = (album: Album) => (album.coverArt ? album.coverArt.maxPx : -1);
    if (before.albumArtFile !== now.albumArtFile || marker(before) !== marker(now)) {
      this.measure();
    }
  }

  public render(): JSX.Element {
    const {size, running, message} = this.state;
    return (
      <div className="metaRow">
        <label>Cover art: </label>
        <span className="metaValue">{this.describe()}</span>
        <button
          className="runExtension"
          disabled={running}
          onClick={() => this.run()}
          title="Fetch the largest cover the Cover Art Archive has for this album"
        >
          {running ? '…' : 'Run'}
        </button>
        {message && <span className="coverArtNote">{message}</span>}
        {!message && size && this.atBest(size) && (
          <span className="coverArtNote">largest the Archive has</span>
        )}
      </div>
    );
  }

  /** True when the file already matches what the Archive gave, so a run cannot improve it. */
  private atBest(size: {width: number; height: number}): boolean {
    const marker = this.props.album.coverArt;
    return !!marker && Math.max(size.width, size.height) >= marker.maxPx;
  }

  private describe(): string {
    if (!this.props.album.albumArtFile) {
      return 'none';
    }
    const {size} = this.state;
    if (!size) {
      // the file is there but unreadable — one album here has a saved HTML error page
      return 'unreadable';
    }
    return `${size.width} × ${size.height}`;
  }

  private measure(): void {
    const file = this.props.album.albumArtFile;
    this.setState({size: file ? imageSize(file) : undefined});
  }

  private run(): void {
    this.setState({message: undefined, running: true});
    this.props.onRun().then(() => {
      this.setState({running: false});
      this.measure();
    }, (err: Error) => {
      this.setState({message: err.message, running: false});
    });
  }
}
