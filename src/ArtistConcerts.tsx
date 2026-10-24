import {shell} from 'electron';
import React from 'react';
import {loadCache} from './concerts/store';
import {Concert} from './concerts/types';
import {localDate} from './utils';

interface OwnProps {
  artistId: string;
}

interface ArtistConcertsState {
  concerts: Concert[];
  where: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_SHOWN = 4;

/**
 * Upcoming shows for one artist, read straight from the concerts cache the Concerts tab fills.
 * Renders nothing at all when there are none, so it never takes up space on most artist pages.
 */
export default class ArtistConcerts extends React.Component<OwnProps, ArtistConcertsState> {
  constructor(props: OwnProps) {
    super(props);
    this.state = {concerts: [], where: ''};
  }

  public componentDidMount(): void {
    this.load();
  }

  public componentDidUpdate(prevProps: OwnProps): void {
    if (prevProps.artistId !== this.props.artistId) {
      this.load();
    }
  }

  public render(): JSX.Element {
    const {concerts} = this.state;
    if (!concerts.length) {
      return <></>;
    }
    return (
      <div className="artistConcerts">
        <label>Upcoming shows: </label>
        {concerts.slice(0, MAX_SHOWN).map((concert) => (
          <div className="artistConcertRow" key={concert.id}>
            <span className="when">{this.when(concert)}</span>
            <span className="where">{[concert.venue, concert.city].filter(Boolean).join(', ')}</span>
            {concert.url && (
              <button
                className="artistConcertTickets"
                onClick={() => shell.openExternal(concert.url as string)}
              >
                Tickets
              </button>
            )}
          </div>
        ))}
        {concerts.length > MAX_SHOWN && (
          <div className="artistConcertRow more">
            {`+${concerts.length - MAX_SHOWN} more near ${this.state.where}`}
          </div>
        )}
      </div>
    );
  }

  private when(concert: Concert): string {
    const date = localDate(concert.date);
    return `${DAYS[date.getDay()]} ${MONTHS[date.getMonth()]} ${date.getDate()}`;
  }

  private load(): void {
    const cache = loadCache();
    this.setState({
      concerts: cache.concerts.filter((concert) => concert.artistIds.indexOf(this.props.artistId) >= 0),
      where: cache.location.label,
    });
  }
}
