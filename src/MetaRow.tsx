import {shell} from 'electron';
import React from 'react';

interface OwnProps {
  label: string;
  /** The field's current value, or a stand-in like "none". */
  value?: string;
  /** When given, the value is a link and opens in the real browser on click. */
  link?: string;
  runTitle?: string;
  /** Quiet text after the button, for something worth saying about the value. */
  note?: string;
  /**
   * When given, a small Run button beside the value.
   *
   * May return a thenable: the button then shows a pending state and puts a failure beside
   * itself rather than throwing it away. `PromiseLike` rather than `Promise` because the
   * extensions run on es6-promise-pool, whose thenable has no `.catch` — only the two-argument
   * `.then` this uses.
   */
  onRun?(): void | PromiseLike<void>;
}

interface State {
  running: boolean;
  message?: string;
}

/**
 * One "label: value" row on an album or artist page, optionally with a Run button.
 *
 * There were four of these — WikiLabel, MusicBrainzLabel, CoverArtLabel and ArtistPicLabel —
 * each with its own copy of the row markup, the link-opening and the Run button, and only one
 * of the four had learnt to show a pending state or report a failed run. The rows differ in
 * what they put in the value, which is what their wrappers still do; they do not differ in how
 * a row behaves.
 */
export default class MetaRow extends React.Component<OwnProps, State> {
  constructor(props: OwnProps) {
    super(props);
    this.state = {running: false};
  }

  public render(): JSX.Element {
    const {label, value, link, onRun, runTitle, note} = this.props;
    const {running, message} = this.state;
    return (
      <div className="metaRow">
        <label>{label}: </label>
        <span
          className={link ? 'link metaValue' : 'metaValue'}
          onClick={() => this.open()}
        >
          {value}
        </span>
        {onRun && (
          <button
            className="runExtension"
            disabled={running}
            onClick={() => this.run()}
            title={runTitle}
          >
            {running ? '…' : 'Run'}
          </button>
        )}
        {message && <span className="coverArtNote">{message}</span>}
        {!message && note && <span className="coverArtNote">{note}</span>}
      </div>
    );
  }

  private open(): void {
    if (this.props.link) {
      shell.openExternal(this.props.link);
    }
  }

  /** Handles both a plain callback and one that returns a promise. */
  private run(): void {
    const onRun = this.props.onRun;
    if (!onRun) {
      return;
    }
    this.setState({message: undefined, running: true});
    const outcome = onRun();
    if (!outcome) {
      this.setState({running: false});
      return;
    }
    outcome.then(
      () => this.setState({running: false}),
      (err: Error) => this.setState({message: err.message, running: false}),
    );
  }
}
