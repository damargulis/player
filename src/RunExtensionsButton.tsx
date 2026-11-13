import React from 'react';
import {BatchProgress} from './extensions/runAll';

interface OwnProps {
  /** What is on screen now; the button acts on exactly this. */
  ids: string[];
  /** "album" or "artist", for the wording. */
  noun: string;
  /**
   * Replaces the "{n} {noun}s" phrase when the run is not all one kind of thing.
   *
   * The New Tracks sweep covers both the albums a drop landed on and the artists credited on
   * it, and "3 albums" would be a lie about half of it.
   */
  describe?: string;
  run(ids: string[], onProgress: (progress: BatchProgress) => void,
      stop: () => boolean): Promise<{done: number; failed: string[]}>;
}

interface State {
  progress?: BatchProgress;
  report?: string;
  confirming: boolean;
}

/**
 * Runs every extension over whatever the picker is currently showing.
 *
 * Over the shown list rather than a selection, because these pickers have no selection — the
 * way to narrow it is the search box already beside this button. Running the unfiltered list is
 * the whole library, which is hours of rate-limited requests, so the count is in the label and
 * it asks before starting rather than after.
 *
 * It can be stopped, and stopping takes effect between items rather than between steps:
 * abandoning mid-album would leave one with an mbid and no cover art, which reads as a bug
 * rather than a cancellation.
 */
export default class RunExtensionsButton extends React.Component<OwnProps, State> {
  private stopped = false;

  constructor(props: OwnProps) {
    super(props);
    this.state = {confirming: false};
  }

  public componentWillUnmount(): void {
    // navigating away must not leave a sweep running against a screen that is gone
    this.stopped = true;
  }

  public render(): JSX.Element {
    const {progress, report, confirming} = this.state;
    if (progress) {
      return (
        <span className="runBatch">
          <span className="runBatchStatus">
            {progress.index}/{progress.total} · {progress.name} · {progress.step}
          </span>
          <button onClick={() => this.stopped = true}>Stop</button>
        </span>
      );
    }
    if (confirming) {
      return (
        <span className="runBatch">
          <span className="runBatchStatus">
            Run all extensions over {this.props.describe || `${this.props.ids.length} `
              + `${this.props.noun}${this.props.ids.length === 1 ? '' : 's'}`}?
          </span>
          <button onClick={() => this.start()}>Yes</button>
          <button onClick={() => this.setState({confirming: false})}>No</button>
        </span>
      );
    }
    return (
      <span className="runBatch">
        <button
          disabled={!this.props.ids.length}
          onClick={() => this.setState({confirming: true, report: undefined})}
        >
          Run extensions ({this.props.ids.length})
        </button>
        {report && <span className="runBatchStatus">{report}</span>}
      </span>
    );
  }

  private start(): void {
    this.stopped = false;
    // the ids are captured here: the list behind them can change while a sweep runs, and
    // switching to a different set halfway through is not what was agreed to
    const ids = this.props.ids.slice();
    this.setState({confirming: false, progress: {index: 0, name: '', step: '', total: ids.length}});
    this.props.run(ids, (progress) => this.setState({progress}), () => this.stopped)
      .then(({done, failed}) => {
        const stopped = done < ids.length ? ' (stopped early)' : '';
        this.setState({
          progress: undefined,
          report: failed.length
            ? `Finished ${done} of ${ids.length}${stopped}; ${failed.join(' and ')} failed somewhere.`
            : `Finished ${done} of ${ids.length}${stopped}.`,
        });
      });
  }
}
