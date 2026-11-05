import {PublishCancelled, publishLyrics} from './extensions/lyrics/publish';
import React from 'react';
import {isSynced, parseLyrics, readLyrics, saveLyrics} from './extensions/lyrics/store';

import './LyricsOverlay.css';

interface OwnProps {
  trackId: string;
  title: string;
  artist: string;
  album: string;
  /** Milliseconds; LRCLIB matches on duration, so a submission needs it. */
  durationMs: number;
  close(): void;
  /** Stores the updated marker, since editing can add or remove timestamps. */
  onSaved(synced: boolean): void;
}

interface State {
  /** The text being edited, or undefined when just reading. */
  draft?: string;
  status?: string;
  statusKind?: 'good' | 'bad' | 'busy';
  submitting: boolean;
}

/**
 * The lyrics for one track, read from disk on open and editable in place.
 *
 * Read rather than held in the library: the text is a few KB per track and 21,000 of them have
 * no business in `library.json`. Opening one file when the listener asks costs nothing.
 *
 * Editing works on the **raw LRC**, timestamps and all, rather than offering a prettier
 * words-only box. Most stored files here are synced, and a words-only editor would have to
 * either discard the timing or guess at re-aligning it — losing sync data to fix a typo is a
 * bad trade, and the usual edit is a word inside a line anyway.
 */
export default class LyricsOverlay extends React.Component<OwnProps, State> {
  private cancelRequested = false;

  constructor(props: OwnProps) {
    super(props);
    this.state = {submitting: false};
  }

  public componentDidMount(): void {
    document.addEventListener('keydown', this.onKeyDown);
  }

  public componentWillUnmount(): void {
    document.removeEventListener('keydown', this.onKeyDown);
    // a solve running in the background has to stop when the panel goes away
    this.cancelRequested = true;
  }

  public render(): JSX.Element {
    const text = this.state.draft === undefined ? readLyrics(this.props.trackId) : undefined;
    const editing = this.state.draft !== undefined;
    return (
      <div className="lyricsBackdrop" onClick={() => this.onBackdropClick()}>
        <div className="lyricsPanel" onClick={(evt) => evt.stopPropagation()}>
          <div className="lyricsHeader">
            <div>
              <div className="lyricsTitle">{this.props.title}</div>
              <div className="lyricsArtist">{this.props.artist}</div>
            </div>
            <button className="lyricsClose" onClick={() => this.props.close()}>×</button>
          </div>
          <div className="lyricsBody">
            {editing
              ? this.renderEditor()
              : text === undefined
                ? <div className="lyricsEmpty">No lyrics stored for this track.</div>
                : this.renderLines(text)}
          </div>
          {this.renderFooter(text, editing)}
        </div>
      </div>
    );
  }

  private renderLines(text: string): JSX.Element[] {
    return parseLyrics(text).map((line, index) => (
      // A blank line is spacing the lyricist put there; keep it rather than collapsing it.
      <div className={`lyricsLine${line.text.trim() ? '' : ' blank'}`} key={index}>
        {line.text}
      </div>
    ));
  }

  private renderEditor(): JSX.Element {
    return (
      <textarea
        autoFocus={true}
        className="lyricsEditor"
        onChange={(evt) => this.setState({draft: evt.target.value})}
        spellCheck={false}
        value={this.state.draft}
      />
    );
  }

  private renderFooter(text: string | undefined, editing: boolean): JSX.Element {
    if (!editing) {
      return (
        <div className="lyricsFooter">
          {this.state.status && (
            <span className={`lyricsStatus ${this.state.statusKind || ''}`}>
              {this.state.status}
            </span>
          )}
          <button className="lyricsAction" onClick={() => this.startEditing(text)}>
            {text === undefined ? 'Add lyrics' : 'Edit'}
          </button>
        </div>
      );
    }
    const busy = this.state.submitting;
    return (
      <div className="lyricsFooter">
        {this.state.status && (
          <span className={`lyricsStatus ${this.state.statusKind || ''}`}>
            {this.state.status}
          </span>
        )}
        <button
          className="lyricsAction"
          disabled={busy}
          onClick={() => this.setState({draft: undefined, status: undefined})}
        >
          Cancel
        </button>
        <button className="lyricsAction" disabled={busy} onClick={() => this.save(false)}>
          Save
        </button>
        <button className="lyricsAction primary" disabled={busy} onClick={() => this.save(true)}>
          Save &amp; submit
        </button>
        {busy && (
          <button className="lyricsAction" onClick={() => this.cancelRequested = true}>
            Stop
          </button>
        )}
      </div>
    );
  }

  private startEditing(text: string | undefined): void {
    this.setState({draft: text === undefined ? '' : text, status: undefined});
  }

  /** Escape closes the panel when reading, but must not discard an edit in progress. */
  private onKeyDown = (evt: KeyboardEvent): void => {
    if (evt.key !== 'Escape') {
      return;
    }
    if (this.state.draft === undefined) {
      this.props.close();
    }
  };

  private onBackdropClick(): void {
    // clicking away from a half-finished edit would throw it out with no warning
    if (this.state.draft === undefined) {
      this.props.close();
    }
  }

  /**
   * Writes the edit to disk, and optionally sends it to LRCLIB.
   *
   * The local save happens **first and unconditionally**: it is the part the listener asked
   * for, it cannot fail in a way worth abandoning, and a 20-second proof of work rejecting at
   * the end must not lose the typing. Upstream is a bonus on top.
   */
  private async save(submit: boolean): Promise<void> {
    const draft = this.state.draft;
    if (draft === undefined) {
      return;
    }
    const synced = isSynced(draft);
    try {
      saveLyrics(this.props.trackId, draft);
      this.props.onSaved(synced);
    } catch (err) {
      this.setState({status: `Could not save: ${(err as Error).message}`, statusKind: 'bad'});
      return;
    }
    if (!submit) {
      this.setState({draft: undefined, status: 'Saved', statusKind: 'good'});
      return;
    }
    this.cancelRequested = false;
    this.setState({status: 'Saved. Solving LRCLIB’s proof of work…', statusKind: 'busy',
      submitting: true});
    const track = {
      album: this.props.album,
      artist: this.props.artist,
      durationMs: this.props.durationMs,
      title: this.props.title,
    };
    try {
      await publishLyrics(track, draft, synced, {
        cancelled: () => this.cancelRequested,
        // the attempt count is the only honest progress signal: the search has no known length
        onProgress: (attempts) => this.setState({
          status: `Saved. Solving LRCLIB’s proof of work… ${attempts.toLocaleString()} tries`,
        }),
      });
      this.setState({draft: undefined, status: 'Saved and submitted to LRCLIB',
        statusKind: 'good', submitting: false});
    } catch (err) {
      const cancelled = err instanceof PublishCancelled;
      this.setState({
        // the local save already happened, so say so rather than leaving it ambiguous
        status: cancelled
          ? 'Saved locally; submission stopped'
          : `Saved locally, but LRCLIB refused it: ${(err as Error).message}`,
        statusKind: cancelled ? 'good' : 'bad',
        submitting: false,
      });
    }
  }
}
