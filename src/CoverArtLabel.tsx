import React from 'react';

interface OwnProps {
  /** Runs the Cover Art extension for this album alone. */
  onRun(): Promise<void>;
}

interface State {
  running: boolean;
  message?: string;
}

/**
 * "Cover art: none", with a button to fetch one.
 *
 * Only rendered for an album that has no art at all — 32 of them here. Everything about a cover
 * that exists moved into `ArtZoom`: the resolution was on the page as "Cover art: 220 × 220",
 * which is a line of text on every album page to serve the handful you would act on, and the
 * Run button beside it was the one thing the number was for. Clicking the art shows both.
 *
 * An album with no art has nothing to click, so this is the only way in.
 */
export default class CoverArtLabel extends React.Component<OwnProps, State> {
  constructor(props: OwnProps) {
    super(props);
    this.state = {running: false};
  }

  public render(): JSX.Element {
    const {running, message} = this.state;
    return (
      <div className="metaRow">
        <label>Cover art: </label>
        <span className="metaValue">none</span>
        <button
          className="runExtension"
          disabled={running}
          onClick={() => this.run()}
          title="Fetch the largest cover the Cover Art Archive has for this album"
        >
          {running ? '…' : 'Run'}
        </button>
        {message && <span className="coverArtNote">{message}</span>}
      </div>
    );
  }

  private run(): void {
    this.setState({message: undefined, running: true});
    this.props.onRun().then(() => {
      this.setState({running: false});
    }, (err: Error) => {
      this.setState({message: err.message, running: false});
    });
  }
}
