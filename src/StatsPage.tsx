import {Album, Artist, Genre, Track} from './redux/actionTypes';
import './StatsPage.css';
import * as React from 'react';
import {connect} from 'react-redux';
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
  // undefined = aggregate favorites over all years
  favoriteYear?: number;
  playMetric: 'sum' | 'median' | 'time';
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
    this.state = {playMetric: 'sum', favSource: 'tracks', favMetric: 'count', skipMetric: 'count'};
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

        <div className="statsColumns">
          {this.rankedList('Top Genres by Time Listened', this.getTopGenres())}
          {this.rankedList('Most Skipped Tracks', this.getTopSkipped(), (
            <div className="statsChipGroup">
              <button
                className={this.state.skipMetric === 'count' ? 'yearChip yearChipActive' : 'yearChip'}
                onClick={() => this.setState({skipMetric: 'count'})}
              >
                Count
              </button>
              <button
                className={this.state.skipMetric === 'rate' ? 'yearChip yearChipActive' : 'yearChip'}
                onClick={() => this.setState({skipMetric: 'rate'})}
              >
                Skip Rate
              </button>
            </div>
          ))}
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

  private getTopSkipped(): RankedItem[] {
    if (this.state.skipMetric === 'rate') {
      // skips as a share of encounters; a floor keeps rarely-seen tracks out
      const MIN_ENCOUNTERS = 10;
      return Object.values(this.props.tracks)
        .map((track) => ({
          track,
          encounters: track.skipCount + track.playCount,
          rate: track.skipCount / ((track.skipCount + track.playCount) || 1),
        }))
        .filter(({track, encounters}) => track.skipCount > 0 && encounters >= MIN_ENCOUNTERS)
        .sort((entry1, entry2) => entry2.rate - entry1.rate || entry2.track.skipCount - entry1.track.skipCount)
        .slice(0, 10)
        .map(({track, rate}) => ({
          id: track.id,
          name: track.name,
          detail: `${this.getArtistNames(track.artistIds)} — ${track.skipCount} skips, ${track.playCount} plays`,
          value: rate,
          label: `${Math.round(rate * 100)}% skipped`,
          goTo: this.props.goToTrack,
        }));
    }
    return Object.values(this.props.tracks)
      .filter((track) => track.skipCount > 0)
      .sort((track1, track2) => track2.skipCount - track1.skipCount)
      .slice(0, 10)
      .map((track) => ({
        id: track.id,
        name: track.name,
        detail: this.getArtistNames(track.artistIds),
        value: track.skipCount,
        label: `${track.skipCount} skips`,
        goTo: this.props.goToTrack,
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

  private barChart(
    title: string,
    bars: Array<{label: string; value: number}>,
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
                <div className="columnLabel">{bar.label}</div>
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
