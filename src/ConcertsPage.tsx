import {Artist, Track} from './redux/actionTypes';
import {setUnseenCount} from './concerts/alerts';
import {apiKeyHelp, CityResult, getApiKey, locateByDevice, locateByIp, searchCities} from './concerts/api';
import './ConcertsPage.css';
import React from 'react';
import {connect} from 'react-redux';
import {getAllTracks, getArtistById} from './redux/selectors';
import {budgetRemaining, isStale, isUpcoming, loadCache, markSeen, refreshConcerts} from './concerts/store';
import {RootState} from './redux/store';
import {Concert, ConcertCache, emptyCache, milesBetween} from './concerts/types';
import {dayKey, localDate} from './utils';

type Filter = 'all' | 'favorites' | 'recent';
type Sort = 'date' | 'plays';
type View = 'list' | 'calendar';

/** Dot size scales with how much the listener plays the acts on the bill. */
function dotSize(plays: number): number {
  if (plays >= 1000) {
    return 11;
  }
  if (plays >= 100) {
    return 9;
  }
  if (plays >= 10) {
    return 7;
  }
  return 5;
}

interface StateProps {
  artists: Artist[];
  /** Total plays per artist id, used to rank what matters. */
  playsByArtist: Record<string, number>;
  /** Artist ids with a track played in the last 90 days. */
  recentArtistIds: string[];
  favoriteArtistIds: string[];
  getArtistName(id: string): string;
}

interface OwnProps {
  goToArtist(artistId: string): void;
}

type ConcertsPageProps = StateProps & OwnProps;

interface ConcertsPageState {
  cache: ConcertCache;
  loading: boolean;
  progress?: string;
  filter: Filter;
  editing: boolean;
  locating: boolean;
  sort: Sort;
  view: View;
  /**
   * Shows that were new when the tab was opened. Held separately from the cache so the NEW
   * markers stay visible for this visit even though the badge clears immediately.
   */
  highlighted: string[];
  /** First of the month the calendar is showing. */
  monthCursor: number;
  selectedDay?: string;
  cityQuery: string;
  cityResults: CityResult[];
  searching: boolean;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

class ConcertsPage extends React.Component<ConcertsPageProps, ConcertsPageState> {
  private mounted = false;

  constructor(props: ConcertsPageProps) {
    super(props);
    this.state = {
      cache: emptyCache(),
      cityQuery: '',
      cityResults: [],
      editing: false,
      filter: 'all',
      locating: false,
      highlighted: [],
      monthCursor: startOfMonth(new Date()).getTime(),
      sort: 'date',
      view: 'list',
      loading: false,
      searching: false,
    };
  }

  public componentDidMount(): void {
    this.mounted = true;
    const cache = loadCache();
    // opening the tab counts as having looked: drop the badge but keep the markers on screen
    this.setState({cache, highlighted: cache.unseen});
    markSeen();
    setUnseenCount(0);
    // only reaches the network when the cache has aged out, so opening the tab is usually free
    if (getApiKey() && isStale(cache)) {
      this.refresh(false);
    }
  }

  public componentWillUnmount(): void {
    this.mounted = false;
  }

  public render(): JSX.Element {
    return (
      <div className="main concerts-page">
        {this.renderHeader()}
        {this.state.editing && this.renderLocationEditor()}
        {this.state.view === 'calendar'
          ? <div className="concerts-cal">{this.renderCalendar()}</div>
          : <div className="concerts-list">{this.renderBody()}</div>}
        <div className="concerts-footer">
          Concert data by <span className="link" onClick={() => this.openUrl('https://www.jambase.com/')}>JamBase</span>
          {this.state.cache.fetchedAt ? ` · updated ${this.ago(this.state.cache.fetchedAt)}` : ''}
          {` · ${budgetRemaining(this.state.cache)} API calls left this month`}
        </div>
      </div>
    );
  }

  private renderHeader(): JSX.Element {
    const {cache, loading} = this.state;
    const location = cache.location;
    return (
      <div className="concerts-header">
        <span className="concerts-title">Concerts</span>
        <span className="concerts-where">
          {`within ${location.radiusMiles} mi of ${location.label} · next ${location.windowDays} days`}
          {this.state.highlighted.length > 0 && (
            <span className="concerts-newcount">
              {`${this.state.highlighted.length} newly announced`}
            </span>
          )}
        </span>
        <span className="concerts-filters">
          {this.renderChip('all', 'All')}
          {this.renderChip('favorites', 'Favorites')}
          {this.renderChip('recent', 'Recently played')}
        </span>
        {this.state.view === 'list' && (
          <span className="concerts-filters">
            {this.renderSort('date', 'By date')}
            {this.renderSort('plays', 'By plays')}
          </span>
        )}
        <button onClick={() => this.toggleView()}>
          {this.state.view === 'list' ? 'Calendar' : 'List'}
        </button>
        <button onClick={() => this.setState({editing: !this.state.editing})}>Where</button>
        <button onClick={() => this.refresh(true)} disabled={loading || !getApiKey()}>
          {loading ? (this.state.progress || 'Refreshing…') : 'Refresh'}
        </button>
      </div>
    );
  }

  private renderLocationEditor(): JSX.Element {
    const location = this.state.cache.location;
    return (
      <div className="concerts-editor">
        <div className="concerts-editor-row">
          <input
            type="text"
            placeholder="Search for your city…"
            value={this.state.cityQuery}
            onChange={(evt) => this.setState({cityQuery: evt.target.value})}
            onKeyDown={(evt) => evt.key === 'Enter' && this.findCities()}
          />
          <button onClick={() => this.findCities()} disabled={this.state.searching}>
            {this.state.searching ? 'Searching…' : 'Search'}
          </button>
          <button onClick={() => this.useMyLocation()} disabled={this.state.locating}>
            {this.state.locating ? 'Locating…' : 'Use my location'}
          </button>
          <label>Radius</label>
          <input
            type="number"
            min="1"
            max="500"
            value={location.radiusMiles}
            onChange={(evt) => this.setLocation({radiusMiles: Number(evt.target.value) || 1})}
          />
          <label>Days ahead</label>
          <input
            type="number"
            min="7"
            max="365"
            value={location.windowDays}
            onChange={(evt) => this.setLocation({windowDays: Number(evt.target.value) || 30})}
          />
        </div>
        {this.state.cityResults.length > 0 && (
          <div className="concerts-cities">
            {this.state.cityResults.map((city) => (
              <button
                key={`${city.label}-${city.lat}-${city.lon}`}
                className="concerts-chip"
                onClick={() => this.pickCity(city)}
              >
                {city.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  private async findCities(): Promise<void> {
    const query = this.state.cityQuery.trim();
    if (!query) {
      return;
    }
    this.setState({searching: true});
    try {
      const cityResults = await searchCities(query);
      this.setState({cityResults, searching: false});
    } catch (err) {
      this.setState({searching: false});
    }
  }

  private async useMyLocation(): Promise<void> {
    this.setState({locating: true});
    try {
      let here: CityResult;
      try {
        // the OS knows best; it only answers once Location Services has been granted
        here = await locateByDevice();
      } catch (deviceErr) {
        const approx = await locateByIp();
        here = {label: `${approx.label} (approx.)`, lat: approx.lat, lon: approx.lon};
      }
      this.pickCity(here);
    } catch (err) {
      this.setState({
        cache: Object.assign({}, this.state.cache, {
          error: err instanceof Error ? err.message : String(err),
        }),
      });
    } finally {
      if (this.mounted) {
        this.setState({locating: false});
      }
    }
  }

  private pickCity(city: CityResult): void {
    this.setLocation({label: city.label, lat: city.lat, lon: city.lon});
    this.setState({cityQuery: '', cityResults: [], editing: false});
    // a new place invalidates everything cached, so go and get it
    this.refresh(true);
  }

  /** Applies a location change locally; the next refresh picks it up. */
  private setLocation(patch: Partial<ConcertCache['location']>): void {
    const location = Object.assign({}, this.state.cache.location, patch);
    this.setState({cache: Object.assign({}, this.state.cache, {location})});
  }

  private renderSort(sort: Sort, label: string): JSX.Element {
    return (
      <button
        className={`concerts-chip ${this.state.sort === sort ? 'on' : ''}`}
        onClick={() => this.setState({sort})}
      >
        {label}
      </button>
    );
  }

  private toggleView(): void {
    const view: View = this.state.view === 'list' ? 'calendar' : 'list';
    // open the calendar on the first month that actually has something in it
    const first = this.visibleConcerts()[0];
    const monthCursor = view === 'calendar' && first
      ? startOfMonth(localDate(first.date)).getTime()
      : this.state.monthCursor;
    this.setState({monthCursor, selectedDay: undefined, view});
  }

  private renderChip(filter: Filter, label: string): JSX.Element {
    return (
      <button
        className={`concerts-chip ${this.state.filter === filter ? 'on' : ''}`}
        onClick={() => this.setState({filter})}
      >
        {label}
      </button>
    );
  }

  private renderBody(): JSX.Element | JSX.Element[] {
    if (!getApiKey()) {
      return (
        <div className="concerts-empty">
          No JamBase API key found, so there is nothing to show yet.<br /><br />
          {apiKeyHelp()}
        </div>
      );
    }
    const concerts = this.sortedConcerts();
    if (!concerts.length) {
      return (
        <div className="concerts-empty">
          {this.state.loading
            ? 'Looking for shows…'
            : this.state.cache.fetchedAt
              ? 'No upcoming shows near you by artists in your library. Try a wider radius, ' +
                'a longer window, or a different filter.'
              : 'Nothing loaded yet — hit Refresh.'}
          {this.state.cache.error && <div className="concerts-error">{this.state.cache.error}</div>}
        </div>
      );
    }
    const out: JSX.Element[] = [];
    let month = '';
    concerts.forEach((concert) => {
      const date = localDate(concert.date);
      // grouping by month only makes sense while the list is in date order
      if (this.state.sort === 'date') {
        const label = `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
        if (label !== month) {
          month = label;
          out.push(<div className="concerts-month" key={`m-${label}`}>{label}</div>);
        }
      }
      out.push(this.renderConcert(concert, date));
    });
    return out;
  }

  private renderCalendar(): JSX.Element {
    if (!getApiKey()) {
      return <div className="concerts-empty">No JamBase API key found. {apiKeyHelp()}</div>;
    }
    const cursor = new Date(this.state.monthCursor);
    const byDay = this.concertsByDay();
    const first = startOfMonth(cursor);
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: JSX.Element[] = [];
    DAYS.forEach((dow) => cells.push(<div className="cal-dow" key={`dow-${dow}`}>{dow}</div>));
    for (let i = 0; i < first.getDay(); i++) {
      cells.push(<div className="cal-day blank" key={`b${i}`} />);
    }
    const todayKey = dayKey(new Date().toISOString());
    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(day)}`;
      cells.push(this.renderDay(key, day, byDay[key] || [], key === todayKey));
    }
    return (
      <>
        <div className="cal-nav">
          <button onClick={() => this.stepMonth(-1)}>‹</button>
          <span className="cal-month">{`${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`}</span>
          <button onClick={() => this.stepMonth(1)}>›</button>
        </div>
        <div className="cal-grid">{cells}</div>
        <div className="cal-legend">
          <span>
            <span className="cal-dot loved" style={{height: 9, width: 9}} />
            an artist you’ve favourited
          </span>
          <span>
            <span className="cal-dot" style={{height: 5, width: 5}} />
            <span className="cal-dot" style={{height: 7, width: 7}} />
            <span className="cal-dot" style={{height: 9, width: 9}} />
            <span className="cal-dot" style={{height: 11, width: 11}} />
            bigger means you play them more
          </span>
        </div>
        {this.renderSelectedDay(byDay)}
      </>
    );
  }

  private renderDay(key: string, day: number, concerts: Concert[], isToday: boolean): JSX.Element {
    const shown = concerts.slice(0, 6);
    const classes = ['cal-day'];
    if (concerts.length) {
      classes.push('has');
    }
    if (isToday) {
      classes.push('today');
    }
    if (concerts.some((concert) => this.isNew(concert))) {
      classes.push('fresh');
    }
    if (this.state.selectedDay === key) {
      classes.push('selected');
    }
    return (
      <div
        className={classes.join(' ')}
        key={key}
        title={concerts.map((c) => this.concertArtistNames(c)).join('\n')}
        onClick={() => concerts.length && this.setState({selectedDay: key})}
      >
        <span className="cal-num">{day}</span>
        <span className="cal-dots">
          {shown.map((concert) => {
            const size = dotSize(this.concertPlays(concert));
            const loved = this.isLoved(concert);
            return (
              <span
                className={`cal-dot ${loved ? 'loved' : ''}`}
                key={concert.id}
                style={{height: size, width: size}}
              />
            );
          })}
          {concerts.length > shown.length &&
            <span className="cal-more">{`+${concerts.length - shown.length}`}</span>}
        </span>
      </div>
    );
  }

  private renderSelectedDay(byDay: Record<string, Concert[]>): JSX.Element {
    const key = this.state.selectedDay;
    const concerts = key ? byDay[key] || [] : [];
    if (!key || !concerts.length) {
      return <div className="cal-legend">Pick a day with dots to see what’s on.</div>;
    }
    const date = localDate(key);
    return (
      <div className="cal-selected-list">
        <div className="cal-selected-head">
          {`${DAYS[date.getDay()]} ${MONTHS[date.getMonth()]} ${date.getDate()}`}
        </div>
        {concerts.map((concert) => this.renderConcert(concert, localDate(concert.date)))}
      </div>
    );
  }

  private stepMonth(delta: number): void {
    const cursor = new Date(this.state.monthCursor);
    cursor.setMonth(cursor.getMonth() + delta);
    this.setState({monthCursor: startOfMonth(cursor).getTime(), selectedDay: undefined});
  }

  private concertsByDay(): Record<string, Concert[]> {
    const byDay: Record<string, Concert[]> = {};
    this.visibleConcerts().forEach((concert) => {
      const key = dayKey(concert.date);
      byDay[key] = (byDay[key] || []).concat([concert]);
    });
    return byDay;
  }

  private concertArtistNames(concert: Concert): string {
    return concert.artistIds.map((id) => this.props.getArtistName(id)).join(', ');
  }

  private isNew(concert: Concert): boolean {
    return this.state.highlighted.indexOf(concert.id) >= 0;
  }

  private isLoved(concert: Concert): boolean {
    return concert.artistIds.some((id) => this.props.favoriteArtistIds.indexOf(id) >= 0);
  }

  private renderConcert(concert: Concert, date: Date): JSX.Element {
    const plays = this.concertPlays(concert);
    const loved = this.isLoved(concert);
    const where = [concert.venue, [concert.city, concert.region].filter(Boolean).join(', ')]
      .filter(Boolean).join(' · ');
    const distance = this.distanceLabel(concert);
    return (
      <div className={`concert-row ${loved ? 'loved' : ''}`} key={concert.id}>
        <span className="concert-date">
          <div className="dow">{DAYS[date.getDay()]}</div>
          <div className="day">{date.getDate()}</div>
        </span>
        <span className="concert-main">
          <div className="concert-artists">
            {this.isNew(concert) && <span className="concert-new">New</span>}
            {concert.artistIds.map((id, i) => (
              <React.Fragment key={id}>
                {i > 0 && ', '}
                <span className="link" onClick={() => this.props.goToArtist(id)}>
                  {this.props.getArtistName(id)}
                </span>
              </React.Fragment>
            ))}
          </div>
          <div className="concert-venue">{where}{distance ? ` · ${distance}` : ''}</div>
        </span>
        <span className="concert-plays">{plays ? `${plays.toLocaleString()} plays` : 'unplayed'}</span>
        {concert.url &&
          <button onClick={() => this.openUrl(concert.url as string)}>Tickets</button>}
      </div>
    );
  }

  /** Shows ranked by how much the listener actually plays the artists on the bill. */
  private concertPlays(concert: Concert): number {
    return concert.artistIds.reduce((total, id) => total + (this.props.playsByArtist[id] || 0), 0);
  }

  private distanceLabel(concert: Concert): string {
    const location = this.state.cache.location;
    if (concert.lat === undefined || concert.lon === undefined) {
      return '';
    }
    const miles = milesBetween(location.lat, location.lon, concert.lat, concert.lon);
    return `${Math.round(miles)} mi`;
  }

  private visibleConcerts(): Concert[] {
    const {filter} = this.state;
    // isUpcoming first: the cache keeps a show until the next sweep, so without it the list
    // runs backwards into gigs that are already over.
    const concerts = this.state.cache.concerts.filter((c) => isUpcoming(c)).filter((concert) => {
      if (filter === 'favorites') {
        return concert.artistIds.some((id) => this.props.favoriteArtistIds.indexOf(id) >= 0);
      }
      if (filter === 'recent') {
        return concert.artistIds.some((id) => this.props.recentArtistIds.indexOf(id) >= 0);
      }
      return true;
    });
    return concerts;
  }

  /** Date order by default; by plays when the listener would rather see what they care about. */
  private sortedConcerts(): Concert[] {
    const concerts = this.visibleConcerts();
    if (this.state.sort !== 'plays') {
      return concerts;
    }
    return concerts.slice().sort((a, b) => {
      const diff = this.concertPlays(b) - this.concertPlays(a);
      return diff !== 0 ? diff : a.date.localeCompare(b.date);
    });
  }

  private async refresh(force: boolean): Promise<void> {
    this.setState({loading: true, progress: undefined});
    const cache = await refreshConcerts(this.props.artists, {
      force,
      location: this.state.cache.location,
      onProgress: (page, total) => {
        if (this.mounted) {
          this.setState({progress: `Page ${page}/${total}…`});
        }
      },
    });
    if (this.mounted) {
      const highlighted = this.state.highlighted
        .concat(cache.unseen.filter((id) => this.state.highlighted.indexOf(id) < 0));
      this.setState({cache, highlighted, loading: false, progress: undefined});
      markSeen();
      setUnseenCount(0);
    } else {
      setUnseenCount(cache.unseen.length);
    }
  }

  private ago(when: number): string {
    const hours = Math.round((Date.now() - when) / (60 * 60 * 1000));
    if (hours < 1) {
      return 'just now';
    }
    return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
  }

  private openUrl(url: string): void {
    const {shell} = require('electron');
    shell.openExternal(url);
  }
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

const RECENT_DAYS = 90;

function mapStateToProps(store: RootState): StateProps {
  const artists = Object.values(store.library.artists);
  const tracks: Track[] = getAllTracks(store);
  const playsByArtist: Record<string, number> = {};
  const recent: Record<string, boolean> = {};
  const favorite: Record<string, boolean> = {};
  const cutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  tracks.forEach((track) => {
    track.artistIds.forEach((id) => {
      playsByArtist[id] = (playsByArtist[id] || 0) + track.playCount;
      if (track.playCount > 0 && track.playDate && track.playDate.getTime() > cutoff) {
        recent[id] = true;
      }
      if (track.favorites && track.favorites.length) {
        favorite[id] = true;
      }
    });
  });
  return {
    artists,
    favoriteArtistIds: Object.keys(favorite),
    getArtistName: (id: string) => {
      const artist = getArtistById(store, id);
      return artist ? artist.name : 'Unknown';
    },
    playsByArtist,
    recentArtistIds: Object.keys(recent),
  };
}

export default connect(mapStateToProps)(ConcertsPage);
