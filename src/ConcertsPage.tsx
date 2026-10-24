import {Artist, Track} from './redux/actionTypes';
import {apiKeyHelp, CityResult, getApiKey, locateByIp, searchCities} from './concerts/api';
import './ConcertsPage.css';
import React from 'react';
import {connect} from 'react-redux';
import {getAllTracks, getArtistById} from './redux/selectors';
import {budgetRemaining, isStale, loadCache, refreshConcerts} from './concerts/store';
import {RootState} from './redux/store';
import {Concert, ConcertCache, emptyCache, milesBetween} from './concerts/types';

type Filter = 'all' | 'favorites' | 'recent';

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
      loading: false,
      searching: false,
    };
  }

  public componentDidMount(): void {
    this.mounted = true;
    const cache = loadCache();
    this.setState({cache});
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
        <div className="concerts-list">{this.renderBody()}</div>
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
        </span>
        <span className="concerts-filters">
          {this.renderChip('all', 'All')}
          {this.renderChip('favorites', 'Favorites')}
          {this.renderChip('recent', 'Recently played')}
        </span>
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
      const here = await locateByIp();
      this.pickCity({label: `${here.label} (approx.)`, lat: here.lat, lon: here.lon});
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
    const concerts = this.visibleConcerts();
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
      const date = new Date(concert.date);
      const label = `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
      if (label !== month) {
        month = label;
        out.push(<div className="concerts-month" key={`m-${label}`}>{label}</div>);
      }
      out.push(this.renderConcert(concert, date));
    });
    return out;
  }

  private renderConcert(concert: Concert, date: Date): JSX.Element {
    const plays = this.concertPlays(concert);
    const loved = concert.artistIds.some((id) => this.props.favoriteArtistIds.indexOf(id) >= 0);
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
    const concerts = this.state.cache.concerts.filter((concert) => {
      if (filter === 'favorites') {
        return concert.artistIds.some((id) => this.props.favoriteArtistIds.indexOf(id) >= 0);
      }
      if (filter === 'recent') {
        return concert.artistIds.some((id) => this.props.recentArtistIds.indexOf(id) >= 0);
      }
      return true;
    });
    // already date-ordered; keep that, since a gig list is only useful chronologically
    return concerts;
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
      this.setState({cache, loading: false, progress: undefined});
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
