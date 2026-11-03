import React from 'react';
import {parseLyrics, readLyrics} from './extensions/lyrics/store';

import './LyricsOverlay.css';

interface OwnProps {
  trackId: string;
  title: string;
  artist: string;
  close(): void;
}

/**
 * The lyrics for one track, read from disk on open.
 *
 * Read rather than held in the library: the text is a few KB per track and 21,000 of them have
 * no business in `library.json`. Opening one file when the listener asks costs nothing.
 *
 * Timestamps are parsed and kept even though nothing highlights them yet — the stored LRC has
 * them, so adding a follow-along later needs no re-fetch and no change here.
 */
export default class LyricsOverlay extends React.Component<OwnProps> {
  public componentDidMount(): void {
    document.addEventListener('keydown', this.onKeyDown);
  }

  public componentWillUnmount(): void {
    document.removeEventListener('keydown', this.onKeyDown);
  }

  public render(): JSX.Element {
    const text = readLyrics(this.props.trackId);
    return (
      <div className="lyricsBackdrop" onClick={() => this.props.close()}>
        <div className="lyricsPanel" onClick={(evt) => evt.stopPropagation()}>
          <div className="lyricsHeader">
            <div>
              <div className="lyricsTitle">{this.props.title}</div>
              <div className="lyricsArtist">{this.props.artist}</div>
            </div>
            <button className="lyricsClose" onClick={() => this.props.close()}>×</button>
          </div>
          <div className="lyricsBody">
            {text === undefined
              ? <div className="lyricsEmpty">No lyrics stored for this track.</div>
              : this.renderLines(text)}
          </div>
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

  private onKeyDown = (evt: KeyboardEvent): void => {
    if (evt.key === 'Escape') {
      this.props.close();
    }
  };
}
