import {Album, Artist, Genre, Track} from './redux/actionTypes';
import * as log from './eventLog';
import * as React from 'react';
import {connect} from 'react-redux';
import './StatsPage.css';
import {RootState} from './redux/store';

interface OwnProps {
  goToAlbum(albumId: string): void;
  goToArtist(artistId: string): void;
  goToTrack(trackId: string): void;
}

interface StateProps {
  tracks: Record<string, Track>;
  albums: Record<string, Album>;
  artists: Record<string, Artist>;
  genres: Record<string, Genre>;
}

type StatsPageProps = OwnProps & StateProps;

interface StatsPageState {
  /**
   * The play log, read once on mount.
   *
   * Read rather than held in Redux: it derives from a file that only this page and the DJ
   * care about, and it is append-only so it cannot go stale mid-session in a way that matters.
   * Read once, not in render — this component re-renders on every action.
   */
  plays?: log.PlayEntry[];
  /** Window for the listening history, in days; 0 means everything the log covers. */
  historyDays: number;
  // undefined = aggregate favorites over all years
  favoriteYear?: number;
  playMetric: 'sum' | 'median' | 'time';
  /** Floor on how many tracks an album or artist must have to be ranked by median. */
  minTracks: number;
  favSource: 'tracks' | 'albums';
  favMetric: 'count' | 'rate';
  skipMetric: 'count' | 'rate';
}

interface RankedItem {
  id: string;
  name: string;
  detail: string;
  value: number;
  label: string;
  goTo?(id: string): void;
}

/**
 * Ceiling on the minimum-tracks slider.
 *
 * Only 81 of this library's 2,173 albums have 20 or more tracks, so a higher ceiling would
 * just offer settings that empty the album list. p99 is 24 and the one 90-track outlier is a
 * box set.
 */
const MAX_MIN_TRACKS = 20;

/**
 * Ranges for the listening history.
 *
 * `days: 0` means everything the log covers, worked out from the earliest entry rather than
 * guessed. Four weeks is the default because it reads as a habit where a year reads as noise.
 */
const HISTORY_RANGES: Array<{label: string; days: number}> = [
  {days: 7, label: '7 days'},
  {days: 28, label: '28 days'},
  {days: 90, label: '90 days'},
  {days: 365, label: '1 year'},
  {days: 0, label: 'All time'},
];
const DEFAULT_HISTORY_DAYS = 28;

/** Sunday first, matching `Date.getDay()`. */
/** One track's skips and plays, from the log for a window or from the entity for all time. */
interface SkipRow {
  id: string;
  track: Track;
  skips: number;
  plays: number;
}

/** Below this, a skip ratio in a window is noise. */
const MIN_RECENT_ENCOUNTERS = 3;
/**
 * The same floor for all time, where the counts are far larger.
 *
 * Lifetime totals include everything the iTunes import brought in, so three encounters is
 * nothing: without this a track skipped once and played twice would outrank a real one.
 */
const MIN_LIFETIME_ENCOUNTERS = 10;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  const mins = Math.floor(ms / 60000) % 60;
  return `${hours}h ${mins}m`;
}

class StatsPage extends React.Component<StatsPageProps, StatsPageState> {
  constructor(props: StatsPageProps) {
    super(props);
    this.state = {
      favMetric: 'count',
      favSource: 'tracks',
      historyDays: DEFAULT_HISTORY_DAYS,
      minTracks: 1,
      playMetric: 'sum',
      skipMetric: 'count',
    };
  }

  public componentDidMount(): void {
    this.setState({plays: log.readPlays()});
  }

  public render(): JSX.Element {
    const tracks = Object.values(this.props.tracks);
    const libraryMs = tracks.reduce((total, track) => total + track.duration, 0);
    const listenMs = tracks.reduce((total, track) => total + track.duration * track.playCount, 0);
    const totalPlays = tracks.reduce((total, track) => total + track.playCount, 0);
    const neverPlayed = tracks.filter((track) => !track.playCount).length;
    return (
      <div className="statsPage">
        <h2>Library Stats</h2>
        <div className="statTiles">
          {this.tile(tracks.length.toLocaleString(), 'tracks')}
          {this.tile(Object.keys(this.props.albums).length.toLocaleString(), 'albums')}
          {this.tile(Object.keys(this.props.artists).length.toLocaleString(), 'artists')}
          {this.tile(Object.keys(this.props.genres).length.toLocaleString(), 'genres')}
          {this.tile(formatDuration(libraryMs), 'library runtime')}
          {this.tile(formatDuration(listenMs), 'time listened')}
          {this.tile(totalPlays.toLocaleString(), 'total plays')}
          {this.tile(neverPlayed.toLocaleString(), 'never played')}
        </div>

        <div className="statsFilterRow">
          <span className="statsFilterLabel">Most played by:</span>
          <button
            className={this.state.playMetric === 'sum' ? 'yearChip yearChipActive' : 'yearChip'}
            onClick={() => this.setState({playMetric: 'sum'})}
          >
            Total Plays
          </button>
          <button
            className={this.state.playMetric === 'median' ? 'yearChip yearChipActive' : 'yearChip'}
            onClick={() => this.setState({playMetric: 'median'})}
          >
            Median Plays
          </button>
          <button
            className={this.state.playMetric === 'time' ? 'yearChip yearChipActive' : 'yearChip'}
            onClick={() => this.setState({playMetric: 'time'})}
          >
            Play Time
          </button>
        </div>
        {this.getMinTracksSlider()}

        <div className="statsColumns">
          {this.rankedList('Most Played Albums', this.getTopAlbums())}
          {this.rankedList('Most Played Artists', this.getTopArtists())}
        </div>

        {this.getFavoritesFilter()}

        <div className="statsColumns">
          {this.barChart(
            'Favorites Crowned per Year',
            this.getFavoritesPerYear(),
            'favorites',
            (label) => this.toggleFavoriteYear(Number(label)),
            this.state.favoriteYear !== undefined ? String(this.state.favoriteYear) : undefined,
            this.getFavSourceToggle(),
          )}
          {this.rankedList('Most Favorited Artists', this.getMostFavoritedArtists())}
        </div>

        <div className="statsColumns">
          {this.rankedList('Most Favorited Tracks', this.getMostFavoritedTracks())}
          {this.rankedList('Most Favorited Albums', this.getMostFavoritedAlbums())}
        </div>

        <div className="statsColumns">
          {this.barChart('Tracks Added by Year', this.getAddedByYear())}
          {this.barChart('Tracks by Release Decade', this.getByDecade())}
        </div>

        {this.getListeningHistory()}

        <div className="statsColumns">
          {/* The all-time "Most Skipped Tracks" list used to sit here. It is the same list as
              "Most Skipped" with the range set to All time, which now reads the lifetime
              counts rather than the log, so there is one skip list instead of two. */}
          {this.rankedList('Top Genres by Time Listened', this.getTopGenres())}

        </div>

        {this.renderCoverage()}
      </div>
    );
  }

  /**
   * How much of the library each extension has filled in.
   *
   * Denominators differ on purpose: Genius and Lyrics are per-track, Wikipedia and MusicBrainz
   * per album and artist, so a single percentage across all four would be meaningless.
   */
  private renderCoverage(): JSX.Element {
    const tracks = Object.values(this.props.tracks);
    const albums = Object.values(this.props.albums);
    const artists = Object.values(this.props.artists);
    // Wikipedia and MusicBrainz are split by entity: a combined figure hides the fact that
    // album and artist coverage are usually very different, which is what you want to see.
    const rows: Array<[string, number, number, string]> = [
      ['Genius', tracks.filter((track) => track.genius && track.genius.page).length,
        tracks.length, 'tracks'],
      ['Lyrics', tracks.filter((track) => track.lyrics && !track.lyrics.instrumental).length,
        tracks.length, 'tracks'],
      ['Wikipedia — albums', albums.filter((album) => album.wikiPage).length,
        albums.length, 'albums'],
      ['Wikipedia — artists', artists.filter((artist) => artist.wikiPage).length,
        artists.length, 'artists'],
      ['MusicBrainz — albums', albums.filter((album) => album.mbid).length,
        albums.length, 'albums'],
      ['MusicBrainz — artists', artists.filter((artist) => artist.mbid).length,
        artists.length, 'artists'],
      // Counted from the stored marker rather than by measuring 2,176 files on every render:
      // the extension writes what the Archive could supply, and absent means never asked.
      ['Cover art — full size', albums.filter((album) => album.coverArt).length,
        albums.length, 'albums'],
    ];
    const synced = tracks.filter((track) => track.lyrics && track.lyrics.synced).length;
    return (
      <div className="statsCoverage">
        <h3>Extension coverage</h3>
        <table className="coverageTable">
          <tbody>
            {rows.map(([label, done, total, unit]) => (
              <tr key={label}>
                <td className="coverageName">{label}</td>
                <td className="coverageBarCell">
                  <div className="coverageBar">
                    <div
                      className="coverageBarFill"
                      style={{width: `${total ? (done / total) * 100 : 0}%`}}
                    />
                  </div>
                </td>
                <td className="coverageCount">
                  {done.toLocaleString()} / {total.toLocaleString()} {unit}
                </td>
                <td className="coveragePercent">
                  {total ? Math.round((done / total) * 100) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="coverageNote">
          {synced.toLocaleString()} of those have synced (timestamped) lyrics.
        </div>
      </div>
    );
  }

  private tile(value: string, label: string): JSX.Element {
    return (
      <div className="statTile" key={label}>
        <div className="statTileValue">{value}</div>
        <div className="statTileLabel">{label}</div>
      </div>
    );
  }

  private sumPlays(trackIds: string[]): number {
    return trackIds.reduce((total, trackId) => {
      const track = this.props.tracks[trackId];
      return total + (track ? track.playCount : 0);
    }, 0);
  }

  /**
   * The minimum-tracks slider, shown only while ranking by median.
   *
   * A median is a per-track figure, so it says nothing about how big the thing is: a
   * one-track single whose only track was played 98 times outranks every real album in this
   * library, and 493 of 2,173 albums have fewer than five tracks. Total plays and play time
   * are already sums, so a size floor there would only hide things the metric was never
   * confused about — hence this appears for median and nothing else.
   *
   * It starts at 1, i.e. filtering nothing, so opening the page shows the same numbers as
   * before and the floor is something the reader chooses.
   */
  private getMinTracksSlider(): JSX.Element | null {
    if (this.state.playMetric !== 'median') {
      return null;
    }
    const {minTracks} = this.state;
    return (
      <div className="statsFilterRow statsSliderRow">
        <span className="statsFilterLabel">Minimum tracks:</span>
        <input
          className="statsSlider"
          max={MAX_MIN_TRACKS}
          min={1}
          onChange={(evt) => this.setState({minTracks: Number(evt.target.value)})}
          type="range"
          value={minTracks}
        />
        <span className="statsSliderValue">
          {minTracks === 1 ? 'any' : `${minTracks}+`}
        </span>
        {minTracks > 1 && (
          <button className="yearChip" onClick={() => this.setState({minTracks: 1})}>
            Clear
          </button>
        )}
      </div>
    );
  }

  /** Tracks the library actually still holds, which is what the median is taken over. */
  private trackCount(trackIds: string[]): number {
    return trackIds.filter((trackId) => this.props.tracks[trackId]).length;
  }

  /**
   * Whether something clears the size floor.
   *
   * Only applied to the median lists, and counting live tracks rather than `trackIds.length`
   * so the floor means the same thing the median does.
   */
  private meetsMinTracks(trackIds: string[]): boolean {
    if (this.state.playMetric !== 'median' || this.state.minTracks <= 1) {
      return true;
    }
    return this.trackCount(trackIds) >= this.state.minTracks;
  }

  /**
   * Median play count across an album's tracks: a robust proxy for complete
   * album listens that a total would bias toward albums with more tracks.
   */
  private medianPlays(trackIds: string[]): number {
    const counts = trackIds
      .map((trackId) => this.props.tracks[trackId])
      .filter(Boolean)
      .map((track) => track.playCount)
      .sort((count1, count2) => count1 - count2);
    if (!counts.length) {
      return 0;
    }
    const mid = Math.floor(counts.length / 2);
    return counts.length % 2 ? counts[mid] : Math.floor((counts[mid - 1] + counts[mid]) / 2);
  }

  private sumPlayTime(trackIds: string[]): number {
    return trackIds.reduce((total, trackId) => {
      const track = this.props.tracks[trackId];
      return total + (track ? track.duration * track.playCount : 0);
    }, 0);
  }

  private playMetricValue(trackIds: string[]): number {
    switch (this.state.playMetric) {
      case 'median':
        return this.medianPlays(trackIds);
      case 'time':
        return this.sumPlayTime(trackIds);
      default:
        return this.sumPlays(trackIds);
    }
  }

  private playMetricLabel(value: number, forAlbum: boolean): string {
    switch (this.state.playMetric) {
      case 'median':
        return forAlbum ? `~${value} full listens` : `${value} median plays`;
      case 'time':
        return formatDuration(value);
      default:
        return `${value} plays`;
    }
  }

  private getTopAlbums(): RankedItem[] {
    return Object.values(this.props.albums)
      .filter((album) => this.meetsMinTracks(album.trackIds))
      .map((album) => ({album, value: this.playMetricValue(album.trackIds)}))
      .filter(({value}) => value > 0)
      .sort((entry1, entry2) => entry2.value - entry1.value
        || this.sumPlays(entry2.album.trackIds) - this.sumPlays(entry1.album.trackIds))
      .slice(0, 10)
      .map(({album, value}) => ({
        id: album.id,
        name: album.name,
        detail: this.getArtistNames(album.artistIds),
        value,
        label: this.playMetricLabel(value, /* forAlbum= */ true),
        goTo: this.props.goToAlbum,
      }));
  }

  private getTopArtists(): RankedItem[] {
    return Object.values(this.props.artists)
      .filter((artist) => this.meetsMinTracks(artist.trackIds))
      .map((artist) => ({artist, value: this.playMetricValue(artist.trackIds)}))
      .filter(({value}) => value > 0)
      .sort((entry1, entry2) => entry2.value - entry1.value
        || this.sumPlays(entry2.artist.trackIds) - this.sumPlays(entry1.artist.trackIds))
      .slice(0, 10)
      .map(({artist, value}) => ({
        id: artist.id,
        name: artist.name,
        detail: '',
        value,
        label: this.playMetricLabel(value, /* forAlbum= */ false),
        goTo: this.props.goToArtist,
      }));
  }

  private getTopGenres(): RankedItem[] {
    const listenByGenre = {} as Record<string, number>;
    Object.values(this.props.tracks).forEach((track) => {
      const ms = track.duration * track.playCount;
      if (!ms) {
        return;
      }
      track.genreIds.forEach((genreId) => {
        listenByGenre[genreId] = (listenByGenre[genreId] || 0) + ms;
      });
    });
    return Object.keys(listenByGenre)
      .sort((genre1, genre2) => listenByGenre[genre2] - listenByGenre[genre1])
      .slice(0, 10)
      .map((genreId) => ({
        id: genreId,
        name: this.props.genres[genreId] ? this.props.genres[genreId].name : 'Unknown',
        detail: '',
        value: listenByGenre[genreId],
        label: formatDuration(listenByGenre[genreId]),
      }));
  }

  private getArtistNames(artistIds: string[]): string {
    return artistIds
      .map((artistId) => this.props.artists[artistId])
      .filter(Boolean)
      .map((artist) => artist.name)
      .join(', ');
  }

  private rankedList(title: string, items: RankedItem[], headerControls?: JSX.Element): JSX.Element {
    const max = items.length ? items[0].value : 1;
    return (
      <div className="statsSection" key={title}>
        <div className="statsSectionHeader">
          <h3>{title}</h3>
          {headerControls}
        </div>
        {items.length === 0 && <div className="statsEmpty">Nothing here yet</div>}
        {items.map((item, index) => (
          <div className="rankedRow" key={item.id} title={`${item.name} — ${item.label}`}>
            <div className="rankedIndex">{index + 1}</div>
            <div className="rankedBody">
              <div className="rankedNames">
                <span
                  className={item.goTo ? 'link' : ''}
                  onClick={() => item.goTo && item.goTo(item.id)}
                >
                  {item.name}
                </span>
                {item.detail && <span className="rankedDetail"> — {item.detail}</span>}
              </div>
              <div className="rankedBarTrack">
                <div className="rankedBar" style={{width: `${(item.value / max) * 100}%`}} />
              </div>
            </div>
            <div className="rankedValue">{item.label}</div>
          </div>
        ))}
      </div>
    );
  }

  private toggleFavoriteYear(year: number): void {
    this.setState({favoriteYear: this.state.favoriteYear === year ? undefined : year});
  }

  /** How many favorite crowns count under the current year filter. */
  private favCount(favorites: number[]): number {
    const year = this.state.favoriteYear;
    if (year === undefined) {
      return favorites.length;
    }
    return favorites.includes(year) ? 1 : 0;
  }

  private getFavoriteYears(): number[] {
    const years = new Set() as Set<number>;
    Object.values(this.props.tracks).forEach((track) => track.favorites.forEach((year) => years.add(year)));
    Object.values(this.props.albums).forEach((album) => album.favorites.forEach((year) => years.add(year)));
    const sorted = [] as number[];
    years.forEach((year) => sorted.push(year));
    return sorted.sort((year1, year2) => year2 - year1);
  }

  private getFavoritesFilter(): JSX.Element {
    const selected = this.state.favoriteYear;
    return (
      <div className="statsFilterRow">
        <span className="statsFilterLabel">Favorites:</span>
        <button
          className={selected === undefined ? 'yearChip yearChipActive' : 'yearChip'}
          onClick={() => this.setState({favoriteYear: undefined})}
        >
          All Years
        </button>
        {this.getFavoriteYears().map((year) => (
          <button
            className={year === selected ? 'yearChip yearChipActive' : 'yearChip'}
            key={year}
            onClick={() => this.toggleFavoriteYear(year)}
          >
            {year}
          </button>
        ))}
        <span className="statsFilterDivider" />
        <button
          className={this.state.favMetric === 'count' ? 'yearChip yearChipActive' : 'yearChip'}
          onClick={() => this.setState({favMetric: 'count'})}
        >
          Count
        </button>
        <button
          className={this.state.favMetric === 'rate' ? 'yearChip yearChipActive' : 'yearChip'}
          onClick={() => this.setState({favMetric: 'rate'})}
        >
          % Favorited
        </button>
      </div>
    );
  }

  private getFavSourceToggle(): JSX.Element {
    return (
      <div className="statsChipGroup">
        <button
          className={this.state.favSource === 'tracks' ? 'yearChip yearChipActive' : 'yearChip'}
          onClick={() => this.setState({favSource: 'tracks'})}
        >
          Tracks
        </button>
        <button
          className={this.state.favSource === 'albums' ? 'yearChip yearChipActive' : 'yearChip'}
          onClick={() => this.setState({favSource: 'albums'})}
        >
          Albums
        </button>
      </div>
    );
  }

  private getFavoritesPerYear(): Array<{label: string; value: number}> {
    const byYear = {} as Record<number, number>;
    const source = this.state.favSource === 'tracks' ? this.props.tracks : this.props.albums;
    Object.values(source).forEach((item: {favorites: number[]}) => {
      item.favorites.forEach((year) => byYear[year] = (byYear[year] || 0) + 1);
    });
    return Object.keys(byYear)
      .map(Number)
      .sort((year1, year2) => year1 - year2)
      .map((year) => ({label: String(year), value: byYear[year]}));
  }

  private favoriteLabel(count: number): string {
    return count === 1 ? '1 year' : `${count} years`;
  }

  private getMostFavoritedTracks(): RankedItem[] {
    const allYears = this.state.favoriteYear === undefined;
    return Object.values(this.props.tracks)
      .filter((track) => this.favCount(track.favorites) > 0)
      .sort(allYears
        ? (track1, track2) => track2.favorites.length - track1.favorites.length
          || track2.playCount - track1.playCount
        // within a single year every match has one crown; rank them by plays
        : (track1, track2) => track2.playCount - track1.playCount)
      .slice(0, 10)
      .map((track) => ({
        id: track.id,
        name: track.name,
        detail: this.getArtistNames(track.artistIds),
        value: allYears ? track.favorites.length : track.playCount,
        label: allYears
          ? `${this.favoriteLabel(track.favorites.length)} · ${track.playCount} plays`
          : `${track.playCount} plays`,
        goTo: this.props.goToTrack,
      }));
  }

  /**
   * A track only counts against a year's favorite rate if it was already in
   * the library that year -- new additions can't have been favorited earlier.
   */
  private eligibleTracks(trackIds: string[]): Track[] {
    const year = this.state.favoriteYear;
    return trackIds
      .map((trackId) => this.props.tracks[trackId])
      .filter(Boolean)
      .filter((track) => {
        if (year === undefined) {
          return true;
        }
        return new Date(track.dateAdded).getFullYear() <= year;
      });
  }

  private getAlbumFavoriteRates(): RankedItem[] {
    const MIN_TRACKS = 4;
    return Object.values(this.props.albums)
      .map((album) => {
        const eligible = this.eligibleTracks(album.trackIds);
        const favorited = eligible.filter((track) => this.favCount(track.favorites) > 0).length;
        return {album, eligible: eligible.length, favorited, rate: favorited / (eligible.length || 1)};
      })
      .filter(({eligible, rate}) => eligible >= MIN_TRACKS && rate > 0)
      .sort((entry1, entry2) => entry2.rate - entry1.rate || entry2.favorited - entry1.favorited)
      .slice(0, 10)
      .map(({album, eligible, favorited, rate}) => ({
        id: album.id,
        name: album.name,
        detail: `${favorited} of ${eligible} tracks`,
        value: rate,
        label: `${Math.round(rate * 100)}%`,
        goTo: this.props.goToAlbum,
      }));
  }

  private getMostFavoritedAlbums(): RankedItem[] {
    if (this.state.favMetric === 'rate') {
      return this.getAlbumFavoriteRates();
    }
    const allYears = this.state.favoriteYear === undefined;
    return Object.values(this.props.albums)
      .filter((album) => this.favCount(album.favorites) > 0)
      .sort(allYears
        ? (album1, album2) => album2.favorites.length - album1.favorites.length
          || this.medianPlays(album2.trackIds) - this.medianPlays(album1.trackIds)
        : (album1, album2) => this.medianPlays(album2.trackIds) - this.medianPlays(album1.trackIds))
      .slice(0, 10)
      .map((album) => ({
        id: album.id,
        name: album.name,
        detail: this.getArtistNames(album.artistIds),
        value: allYears ? album.favorites.length : this.medianPlays(album.trackIds),
        label: allYears
          ? `${this.favoriteLabel(album.favorites.length)} · ~${this.medianPlays(album.trackIds)} listens`
          : `~${this.medianPlays(album.trackIds)} full listens`,
        goTo: this.props.goToAlbum,
      }));
  }

  private countArtistFavorites(artist: Artist): number {
    const trackFavorites = artist.trackIds.reduce((total, trackId) => {
      const track = this.props.tracks[trackId];
      return total + (track ? this.favCount(track.favorites) : 0);
    }, 0);
    const albumFavorites = artist.albumIds.reduce((total, albumId) => {
      const album = this.props.albums[albumId];
      return total + (album ? this.favCount(album.favorites) : 0);
    }, 0);
    return trackFavorites + albumFavorites;
  }

  private getMostFavoritedArtists(): RankedItem[] {
    if (this.state.favMetric === 'rate') {
      return this.getFavoriteRates();
    }
    return Object.values(this.props.artists)
      .map((artist) => ({artist, favorites: this.countArtistFavorites(artist)}))
      .filter(({favorites}) => favorites > 0)
      .sort((entry1, entry2) => entry2.favorites - entry1.favorites)
      .slice(0, 10)
      .map(({artist, favorites}) => ({
        id: artist.id,
        name: artist.name,
        detail: '',
        value: favorites,
        label: `${favorites} favorites`,
        goTo: this.props.goToArtist,
      }));
  }

  private getFavoriteRates(): RankedItem[] {
    const MIN_TRACKS = 10;
    return Object.values(this.props.artists)
      .map((artist) => {
        const eligible = this.eligibleTracks(artist.trackIds);
        const favorited = eligible.filter((track) => this.favCount(track.favorites) > 0).length;
        return {artist, eligible: eligible.length, favorited, rate: favorited / (eligible.length || 1)};
      })
      .filter(({eligible, rate}) => eligible >= MIN_TRACKS && rate > 0)
      .sort((entry1, entry2) => entry2.rate - entry1.rate || entry2.favorited - entry1.favorited)
      .slice(0, 10)
      .map(({artist, eligible, favorited, rate}) => ({
        id: artist.id,
        name: artist.name,
        detail: `${favorited} of ${eligible} tracks`,
        value: rate,
        label: `${Math.round(rate * 100)}%`,
        goTo: this.props.goToArtist,
      }));
  }

  private getAddedByYear(): Array<{label: string; value: number}> {
    const byYear = {} as Record<number, number>;
    Object.values(this.props.tracks).forEach((track) => {
      const date = new Date(track.dateAdded);
      const year = date.getFullYear();
      if (year > 1971 && year <= new Date().getFullYear()) {
        byYear[year] = (byYear[year] || 0) + 1;
      }
    });
    return Object.keys(byYear)
      .map(Number)
      .sort((year1, year2) => year1 - year2)
      .map((year) => ({label: String(year), value: byYear[year]}));
  }

  private getByDecade(): Array<{label: string; value: number}> {
    const byDecade = {} as Record<number, number>;
    Object.values(this.props.tracks).forEach((track) => {
      if (track.year && track.year >= 1900) {
        const decade = Math.floor(track.year / 10) * 10;
        byDecade[decade] = (byDecade[decade] || 0) + 1;
      }
    });
    return Object.keys(byDecade)
      .map(Number)
      .sort((decade1, decade2) => decade1 - decade2)
      .map((decade) => ({label: `${decade}s`, value: byDecade[decade]}));
  }

  /**
   * What the play log makes possible, and nothing else in the app can answer.
   *
   * `Track.playDate` is one date per song, so until this log existed there was no way to ask
   * what a week of listening looked like or which hours anyone actually listens in. It renders
   * nothing at all until there are plays, rather than showing an empty chart that reads as
   * broken — the log only starts filling from the build that introduced it.
   */
  /** The range chips above the listening history. */
  private getHistoryRanges(): JSX.Element {
    return (
      <div className="statsFilterRow">
        <span className="statsFilterLabel">Range:</span>
        {HISTORY_RANGES.map((range) => (
          <button
            className={this.state.historyDays === range.days ? 'yearChip yearChipActive' : 'yearChip'}
            key={range.label}
            onClick={() => this.setState({historyDays: range.days})}
          >
            {range.label}
          </button>
        ))}
      </div>
    );
  }

  /**
   * What the event log makes possible, and nothing else in the app can answer.
   *
   * `Track.playDate` is one date per song, so until this log existed there was no way to ask
   * what a week of listening looked like or which hours anyone listens in. It renders nothing
   * at all until there are events, rather than an empty chart that reads as broken.
   *
   * Everything here follows the chosen range, including the hour and weekday breakdowns — a
   * visible range selector that some charts ignored would be worse than no selector.
   */
  private getListeningHistory(): JSX.Element {
    const plays = this.state.plays;
    if (!plays || !plays.length) {
      return <></>;
    }
    // plays only: a skip or a favourite is not listening, and would inflate every bar
    const listened = log.onlyPlays(plays);
    // 0 means everything, worked out from the earliest entry rather than guessed
    const days = this.state.historyDays || log.spanInDays(plays);
    const label = this.rangeLabel(days);
    const recent = log.since(listened, days);
    const recentAll = log.since(plays, days);

    const unit = log.bucketFor(days);
    const buckets = log.playsByBucket(listened, days);
    // ticks thin out as columns multiply, or the labels collide
    const every = Math.max(1, Math.ceil(buckets.length / 10));
    const periods = buckets.map((bucket, index) => ({
      label: log.dayOf(bucket.at),
      tick: index % every === 0 ? this.bucketTick(bucket.at, unit) : '',
      value: bucket.value,
    }));

    // every hour is a column; only every third carries a tick, or they collide
    const hours = log.playsByHour(recent).map((value: number, hour: number) => ({
      label: `${hour}`,
      tick: hour % 3 === 0 ? `${hour}` : '',
      value,
    }));
    const weekdays = log.playsByWeekday(recent)
      .map((value: number, index: number) => ({label: WEEKDAYS[index], value}));

    const total = recent.reduce((sum, entry) => sum + entry.count, 0);
    const estimated = recent.filter((entry) => entry.estimated)
      .reduce((sum, entry) => sum + entry.count, 0);
    const skips = log.ofType(recentAll, 'skip').length;
    const favourites = log.ofType(recentAll, 'favorite').length;
    const unitName = unit === 'day' ? 'Day' : unit === 'week' ? 'Week' : 'Month';
    return (
      <>
        {this.getHistoryRanges()}
        <div className="statsColumns">
          {this.barChart(`Plays by ${unitName}, ${label}`, periods, 'plays')}
          {this.barChart(`Plays by Hour of Day, ${label}`, hours, 'plays')}
        </div>
        <div className="statsColumns">
          {this.barChart(`Plays by Day of Week, ${label}`, weekdays, 'plays')}
          {this.rankedList(`Most Skipped, ${label}`, this.getSkipList(recentAll), (
            <div className="statsChipGroup">
              <button
                className={this.state.skipMetric === 'rate' ? 'yearChip yearChipActive' : 'yearChip'}
                onClick={() => this.setState({skipMetric: 'rate'})}
              >
                Skip Rate
              </button>
              <button
                className={this.state.skipMetric === 'count' ? 'yearChip yearChipActive' : 'yearChip'}
                onClick={() => this.setState({skipMetric: 'count'})}
              >
                Count
              </button>
            </div>
          ))}
        </div>
        <div className="statsColumns">
          {this.rankedList(`First Heard, ${label}`, this.getFirstHeard(plays, recent))}
          {this.rankedList(`Most Played, ${label}`, this.getRecentFavourites(recent))}
        </div>
        <div className="statsNote">
          {log.activeDays(recent)} of {days} days had listening ·{' '}
          {total.toLocaleString()} plays
          {skips ? `, ${skips.toLocaleString()} skips` : ''}
          {favourites ? `, ${favourites.toLocaleString()} favourites` : ''}
          {' in this range'}
          {estimated ? `; ${estimated.toLocaleString()} of them synced from a phone build that
            kept no times, so they count toward days but not hours` : ''}
        </div>
      </>
    );
  }

  /** "Last 28 Days", or "All Time" when the range is everything the log covers. */
  private rangeLabel(days: number): string {
    if (!this.state.historyDays) {
      return 'All Time';
    }
    return days === 365 ? 'Last Year' : `Last ${days} Days`;
  }

  /** A column's tick: the day for daily buckets, the month for anything coarser. */
  private bucketTick(at: number, unit: log.Bucket): string {
    const date = new Date(at);
    if (unit === 'month') {
      return date.toLocaleDateString(undefined, {month: 'short'});
    }
    return log.dayOf(at).slice(5);
  }

  /**
   * The skip list for the chosen range — the only one, now that it covers all time too.
   *
   * All time reads `Track.skipCount`/`playCount`, not the log, because those are the complete
   * picture: the 17,140 skips the iTunes import brought in plus every one recorded since. The
   * log only reaches back to when it was first written, so an "all time" list built from it
   * would quietly mean "since the log started". Any shorter range has to read the log, which is
   * the only thing that knows *when* a skip happened.
   *
   * The floors differ for the same reason. Lifetime counts are large, so 10 encounters keeps a
   * once-skipped track out of a 100%-skipped slot; a 7-day window would never clear that bar.
   */
  private lifetimeSkipRows(): SkipRow[] {
    return Object.values(this.props.tracks)
      .map((track) => ({id: track.id, plays: track.playCount, skips: track.skipCount, track}));
  }

  private loggedSkipRows(entries: log.PlayEntry[]): SkipRow[] {
    const rates = log.skipRate(entries);
    return Object.keys(rates).map((id) => ({id, track: this.props.tracks[id], ...rates[id]}));
  }

  private getSkipList(entries: log.PlayEntry[]): RankedItem[] {
    const lifetime = this.state.historyDays === 0;
    const rows = lifetime ? this.lifetimeSkipRows() : this.loggedSkipRows(entries);
    const floor = lifetime ? MIN_LIFETIME_ENCOUNTERS : MIN_RECENT_ENCOUNTERS;
    const byCount = this.state.skipMetric === 'count';
    return rows
      .filter(({track, skips, plays}) => track && skips > 0 && skips + plays >= floor)
      .sort((one, two) => byCount
        ? two.skips - one.skips
        : (two.skips / (two.skips + two.plays)) - (one.skips / (one.skips + one.plays)) ||
          two.skips - one.skips)
      .slice(0, 10)
      .map(({id, track, skips, plays}) => ({
        detail: this.getArtistNames(track.artistIds),
        goTo: this.props.goToTrack,
        id,
        label: byCount
          ? `${skips.toLocaleString()} skip${skips === 1 ? '' : 's'}`
          : `${skips} of ${skips + plays}`,
        name: track.name,
        value: byCount ? skips : Math.round((skips / (skips + plays)) * 100),
      }));
  }

  /**
   * Tracks whose first logged play falls inside the window.
   *
   * "What did I discover", which `playCount` cannot answer — it is a total with no sense of
   * when any of it happened. Only as old as the log, so it is honest about being incomplete
   * rather than claiming an import date is a discovery.
   */
  private getFirstHeard(all: log.PlayEntry[], window: log.PlayEntry[]): RankedItem[] {
    const counts = log.playsByTrack(window);
    return log.firstHeardIn(all, window)
      .map((id) => ({id, plays: counts[id] || 0, track: this.props.tracks[id]}))
      .filter(({track}) => !!track)
      .sort((one, two) => two.plays - one.plays)
      .slice(0, 10)
      .map(({id, plays, track}) => ({
        detail: this.getArtistNames(track.artistIds),
        id,
        label: `${plays} play${plays === 1 ? '' : 's'}`,
        name: track.name,
        value: plays,
        goTo: this.props.goToTrack,
      }));
  }

  /** Most played in the window, which is a different question from most played ever. */
  private getRecentFavourites(window: log.PlayEntry[]): RankedItem[] {
    const counts = log.playsByTrack(window);
    return Object.keys(counts)
      .map((id) => ({id, plays: counts[id], track: this.props.tracks[id]}))
      .filter(({track}) => !!track)
      .sort((one, two) => two.plays - one.plays)
      .slice(0, 10)
      .map(({id, plays, track}) => ({
        detail: this.getArtistNames(track.artistIds),
        id,
        label: `${plays} play${plays === 1 ? '' : 's'}`,
        name: track.name,
        value: plays,
        goTo: this.props.goToTrack,
      }));
  }

  private barChart(
    title: string,
    bars: Array<{label: string; value: number; tick?: string}>,
    unit: string = 'tracks',
    onBarClick?: (label: string) => void,
    selectedLabel?: string,
    headerControls?: JSX.Element,
  ): JSX.Element {
    const max = bars.reduce((best, bar) => Math.max(best, bar.value), 1);
    return (
      <div className="statsSection" key={title}>
        <div className="statsSectionHeader">
          <h3>{title}</h3>
          {headerControls}
        </div>
        {bars.length === 0 && <div className="statsEmpty">Nothing here yet</div>}
        <div className="columnChart">
          {bars.map((bar) => {
            const classes = ['columnCell'];
            if (onBarClick) {
              classes.push('columnCellClickable');
            }
            if (bar.label === selectedLabel) {
              classes.push('columnCellSelected');
            }
            return (
              <div
                className={classes.join(' ')}
                key={bar.label}
                onClick={() => onBarClick && onBarClick(bar.label)}
                title={`${bar.label}: ${bar.value.toLocaleString()} ${unit}`}
              >
                <div className="columnBarArea">
                  <div className="columnValue" style={{bottom: `${(bar.value / max) * 100}%`}}>
                    {bar.value.toLocaleString()}
                  </div>
                  <div className="columnBar" style={{height: `${(bar.value / max) * 100}%`}} />
                </div>
                <div className="columnLabel">
                  {bar.tick === undefined ? bar.label : bar.tick}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

}

function mapStateToProps(store: RootState): StateProps {
  return {
    tracks: store.library.tracks,
    albums: store.library.albums,
    artists: store.library.artists,
    genres: store.library.genres,
  };
}

export default connect(mapStateToProps)(StatsPage);
