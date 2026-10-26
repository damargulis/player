import {shell} from 'electron';
import React from 'react';
import {concertsForArtists} from './concerts/store';
import {Concert} from './concerts/types';
import {localDate} from './utils';

import './ConcertBadge.css';

interface OwnProps {
  artistIds: string[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * A ticket next to the now-playing artist when they have a show coming up nearby.
 *
 * Lives in `InfoPanel`, which both the full header and the 240x120 mini player render, so one
 * badge covers both. Renders nothing when there is no show, which is the common case — this
 * has to stay invisible on most tracks or it stops meaning anything.
 *
 * Reads the same cache the Concerts tab fills; it never fetches, so it costs no API calls and
 * works offline.
 */
export default class ConcertBadge extends React.Component<OwnProps> {
  public render(): JSX.Element {
    const concerts = concertsForArtists(this.props.artistIds);
    if (!concerts.length) {
      return <></>;
    }
    const next = concerts[0];
    return (
      <span
        className="concertBadge"
        onClick={() => this.onClick(next)}
        title={this.tooltip(concerts)}
      >
        🎟️
      </span>
    );
  }

  /** The whole point is the detail, so the hover carries date, venue and any others. */
  private tooltip(concerts: Concert[]): string {
    const next = concerts[0];
    const date = localDate(next.date);
    const when = `${MONTHS[date.getMonth()]} ${date.getDate()}`;
    const where = [next.venue, next.city].filter(Boolean).join(', ');
    const more = concerts.length > 1 ? ` (+${concerts.length - 1} more)` : '';
    const tickets = next.url ? ' — click for tickets' : '';
    return `${when}: ${where}${more}${tickets}`;
  }

  private onClick(next: Concert): void {
    if (next.url) {
      shell.openExternal(next.url);
    }
  }
}
