import {addToPlaylist, setPlaylist, updateLibrary, updateTrack} from './redux/actions';
import {Album, Artist, LibraryInfo, Playlist, Track, TrackInfo} from './redux/actionTypes';
import {remote} from 'electron';
import EmptyPlaylist from './playlist/EmptyPlaylist';
import ExternalLink from './ExternalLink';
import favoriteImg from './resources/favorite.png';
import runGeniusExtension from './extensions/genius/main';
import playingImg from './resources/playing.svg';
import RandomTrackPlaylist from './playlist/RandomTrackPlaylist';
import React from 'react';
import Modal from 'react-modal';
import {connect} from 'react-redux';
import {AutoSizer, Column, Table} from 'react-virtualized';
import SearchBar from './SearchBar';
import {getPlaylists} from './redux/selectors';
import {getAlbumsByIds, getArtistsByIds, getCurrentTrackId, getGenresByIds} from './redux/selectors';
import {RootState} from './redux/store';
import '../node_modules/react-virtualized/styles.css';
import TrackEditor from './TrackEditor';
import './TrackPicker.css';
import {toTime} from './utils';

// see: http://reactcommunity.org/react-modal/accessibility/#app-element
Modal.setAppElement('#root');

type Sort = 'ASC' | 'DESC';

interface TrackPickerState {
  sortBy: string;
  sortDirection: Sort;
  tracks: Track[];
  selected: number[];
  scrollTo: number;
  lastSelected?: number;
  search: string;
  editing: boolean;
}

interface StateProps {
  playlists: Playlist[];
  currentlyPlayingId?: string;
  getArtistsByIds(ids: string[]): Artist[];
  getAlbumsByIds(ids: string[]): Album[];
  getGenresByIds(ids: string[]): string[];
  runGeniusExtension(trackIds: string[]): PromiseLike<LibraryInfo>;
}

interface OwnProps {
  tracks: Track[];
  scrollToTrackId?: string;
  sortBy?: string;
}

interface DispatchProps {
  setPlaylist(playlist: EmptyPlaylist, play: boolean): void;
  updateTrack(id: string, info: TrackInfo): void;
  addToPlaylist(index: number, trackIds: string[]): void;
  updateLibrary(update: LibraryInfo): void;
}

type TrackPickerProps = StateProps & OwnProps & DispatchProps;

class TrackPicker extends React.Component<TrackPickerProps, TrackPickerState> {
  constructor(props: TrackPickerProps) {
    super(props);

    const sortDirection = 'ASC';
    const sortBy = this.props.sortBy || 'name';
    const tracks = this.sortTracks(sortBy, sortDirection);

    this.state = {
      editing: false,
      search: '',
      // TODO: change to a set
      selected: [],
      tracks,
      sortBy,
      sortDirection,
      scrollTo: -1,
    };
  }

  public componentDidMount(): void {
    this.sort(this.state);
    this.setScroll();
  }

  public componentDidUpdate(prevProps: TrackPickerProps): void {
    if (prevProps.tracks !== this.props.tracks) {
      this.sort(this.state);
    }
    // TODO: scroll doesnt happen again if you click same track title, maybe change this to an action?
    if (prevProps.scrollToTrackId !== this.props.scrollToTrackId) {
      this.setScroll();
    }
  }

  public render(): JSX.Element {
    const selectedTracks = this.state.selected.map((trackId) => {
      return this.state.tracks[trackId];
    });
    return (
      <div className="main">
        <Modal isOpen={this.state.editing} onRequestClose={() => this.closeEdit()} >
          <TrackEditor exit={() => this.closeEdit()} tracks={selectedTracks} />
        </Modal>
        <SearchBar onSearch={(search) => this.onSearch(search)} />
        <AutoSizer>
          {({height, width}) => {
            return (
              <Table
                headerHeight={20}
                height={height - 40}
                onRowClick={(evt) => this.onRowClick(evt)}
                onRowDoubleClick={(evt) => this.onRowDoubleClick(evt)}
                onRowRightClick={(evt: {index: number}) => this.doRowRightClick(evt)}
                rowClassName="trackRow"
                rowCount={this.state.tracks.length}
                rowGetter={({index}) => this.getTrackData(index)}
                rowHeight={15}
                rowStyle={({index}) => this.getRowStyle(index)}
                scrollToIndex={this.state.scrollTo}
                sort={(data) => this.sort(data)}
                sortBy={this.state.sortBy}
                sortDirection={this.state.sortDirection}
                width={width}
              >
                <Column dataKey="index" label="#" width={50} />
                <Column dataKey="name" label="Name" width={300} />
                <Column dataKey="playing" width={10} cellRenderer={this.playingRenderer}/>
                <Column dataKey="favorite" width={15} cellRenderer={this.favoriteRenderer}/>
                <Column dataKey="genius" width={10} cellRenderer={this.geniusRenderer}/>
                <Column dataKey="duration" label="Time" width={50} />
                <Column dataKey="artists" label="Artists" width={150} />
                <Column dataKey="albums" label="Albums" width={150} />
                <Column dataKey="genres" label="Genres" width={100} />
                <Column dataKey="year" label="Year" width={50} />
                <Column dataKey="playCount" label="Plays" width={80} />
              </Table>
            );
          }}
        </AutoSizer>
        <div className="status-bar" >
          <span style={{float: 'left', paddingLeft: '3px'}}>{this.state.tracks.length} Tracks</span>
          <span style={{float: 'right', paddingRight: '3px'}}>{this.getDuration()}</span>
        </div>
      </div>
    );
  }

  private geniusRenderer({cellData}: {cellData?: string}): JSX.Element {
    return (<ExternalLink text="G" link={cellData}/>);
  }

  private playingRenderer({cellData}: {cellData?: boolean}): JSX.Element {
    return (
      cellData ? <img style={{marginTop: '3px'}} src={playingImg} alt="isPlaying"/> : <span/>
    );
  }

  private favoriteRenderer({cellData}: {cellData?: boolean}): JSX.Element {
    return (
      cellData ? <img height="10px" width="10px" src={favoriteImg} alt="favotie"/> : <span/>
    );
  }

  private getDuration(): string {
    const duration = this.props.tracks.reduce((total: number, track: Track) => total + track.duration, 0);
    return toTime(duration);
  }

  private setScroll(): void {
    const scrollTo = this.state.tracks.findIndex((track) => {
      return track.id === this.props.scrollToTrackId;
    });
    if (scrollTo) {
      this.setState({scrollTo, selected: [scrollTo]});
    }
  }

  private sortTracks(sortBy: string, sortDirection: string): Track[] {
    let tracks = this.props.tracks.slice().filter((track) => {
      if (this.state && this.state.search) {
        return track.name.toLowerCase().includes(this.state.search.toLowerCase());
      }
      return true;
    });
    switch (sortBy) {
    case 'index':
      break;
    case 'name':
      tracks = tracks.sort((track1, track2) => {
        return track1.name.localeCompare(track2.name);
      });
      break;
    case 'duration':
      tracks = tracks.sort((track1, track2) => {
        return track1.duration - track2.duration;
      });
      break;
    case 'year':
      tracks = tracks.sort((track1, track2) => {
        return track1.year - track2.year;
      });
      break;
    case 'playCount':
      tracks = tracks.sort((track1, track2) => {
        return track1.playCount - track2.playCount;
      });
      break;
    case 'artists':
      tracks = tracks.sort((track1, track2) => {
        const artists1 = this.props.getArtistsByIds(track1.artistIds)
          .map((artist) => artist.name).join(', ');
        const artists2 = this.props.getArtistsByIds(track2.artistIds)
          .map((artist) => artist.name).join(', ');
        return artists1.localeCompare(artists2);
      });
      break;
    case 'albums':
      tracks = tracks.sort((track1, track2) => {
        const albums1 = this.props.getAlbumsByIds(track1.albumIds)
          .map((album) => album.name).join(', ');
        const albums2 = this.props.getAlbumsByIds(track2.albumIds)
          .map((album) => album.name).join(', ');
        return albums1.localeCompare(albums2);
      });
      break;
    case 'genres':
      tracks = tracks.sort((track1, track2) => {
        const genres1 = this.props.getGenresByIds(track1.genreIds)
          .join(', ');
        const genres2 = this.props.getGenresByIds(track2.genreIds)
          .join(', ');
        return genres1.localeCompare(genres2);
      });
      break;
    default:
      break;
    }
    if (sortDirection === 'DESC') {
      tracks = tracks.reverse();
    }
    return tracks;
  }

  private getTrackData(index: number): object {
    const track = this.state.tracks[index];
    const year = new Date().getFullYear();
    return {
      albums: this.props.getAlbumsByIds(track.albumIds)
        .map((album) => album.name).join(', '),
      artists: this.props.getArtistsByIds(track.artistIds)
        .map((artist) => artist.name).join(', '),
      duration: toTime(track.duration),
      genres: this.props.getGenresByIds(track.genreIds).join(', '),
      index: this.props.tracks.indexOf(track) + 1,
      name: track.name,
      playCount: track.playCount,
      year: track.year,
      playing: track.id === this.props.currentlyPlayingId,
      genius: track.genius && track.genius.page,
      favorite: track.favorites.indexOf(year) !== -1,
    };
  }

  private getRowStyle(index: number): React.CSSProperties {
    const style = {
      backgroundColor: index % 2 === 0 ? 'white' : 'lightgray',
      borderTop: 'solid black 1px',
      fontSize: 10,
      userSelect: 'none',
    } as React.CSSProperties;
    if (index === -1) {
      style.backgroundColor = 'gray';
    }
    if (this.state.selected.includes(index)) {
      style.backgroundColor = '#5e92e0';
    }
    return style;
  }

  private doShiftClick(index: number): void {
    if (!this.state.lastSelected && this.state.lastSelected !== 0) {
      this.doClickTrack(index);
      return;
    }
    const selected = this.state.selected;
    const min = Math.min(index, this.state.lastSelected);
    const max = Math.max(index, this.state.lastSelected);
    for (let ind = min; ind <= max; ind++) {
      if (!selected.includes(ind)) {
        selected.push(ind);
      }
    }
    this.setState({selected});
  }

  private edit(): void {
    this.setState({editing: true});
  }

  private playNext(): void {
    // TODO: this
  }

  private favorite(): void {
    const year = new Date().getFullYear();
    this.state.selected.forEach((id) => {
      const track = this.state.tracks[id];
      if (track.favorites.indexOf(year) < 0) {
        const favorites = [...track.favorites, year];
        this.props.updateTrack(track.id, {favorites});
      }
    });
  }

  private doRowRightClick({index}: {index: number}): void {
    if (!this.state.selected.includes(index)) {
      this.setState({selected: [index], lastSelected: index}, () => this.doRowRightClickNext(index));
    } else {
      this.doRowRightClickNext(index);
    }
  }

  private runGenius(): void {
    const trackIds = this.state.selected.map((index) => this.state.tracks[index].id);
    this.props.runGeniusExtension(trackIds).then((updates) => {
      this.props.updateLibrary(updates);
    });
  }

  private doRowRightClickNext(index: number): void {
    const menu = new remote.Menu();
    menu.append(new remote.MenuItem({label: 'Edit Info', click: this.edit.bind(this)}));
    if (this.state.selected.length === 1) {
      menu.append(new remote.MenuItem({label: 'Play', click: () => this.doDoubleClickTrack(index)}));
    }
    menu.append(new remote.MenuItem({label: 'Play Next', click: this.playNext.bind(this)}));
    menu.append(new remote.MenuItem({label: 'Favorite', click: this.favorite.bind(this)}));
    menu.append(new remote.MenuItem({label: 'Extensions', submenu: [{
      label: 'Genius', click: this.runGenius.bind(this),
    }]}));
    const playlists = this.props.playlists.map((playlist, playlistIndex) => {
      return {
        label: playlist.name,
        click: () => {
          const ids = this.state.selected.map((trackIndex) => this.state.tracks[trackIndex].id);
          this.props.addToPlaylist(playlistIndex, ids);
        },
      };
    });
    menu.append(new remote.MenuItem({label: 'Add To Playlist', submenu: playlists}));
    // TODO:
    //  - add to end of currently playing playlist
    //  - add to specific playlist
    menu.popup({window: remote.getCurrentWindow()});
  }

  private doCmdClick(index: number): void {
    let selected = this.state.selected;
    if (selected.includes(index)) {
      selected = selected.filter((ind) => ind !== index);
    } else {
      selected.push(index);
    }
    this.setState({lastSelected: index, selected});
  }

  private onRowClick({event, index}:
      {event: {ctrlKey: boolean; shiftKey: boolean; metaKey: boolean}; index: number}): void {
    if (event.shiftKey) {
      this.doShiftClick(index);
    } else if (event.metaKey || event.ctrlKey) {
      this.doCmdClick(index);
    } else {
      this.doClickTrack(index);
    }
  }

  private onRowDoubleClick({event, index}:
    {event: {shiftKey: boolean; metaKey: boolean; ctrlKey: boolean}; index: number},
  ): void {
    if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
      this.doDoubleClickTrack(index);
    }
  }

  private doClickTrack(index: number): void {
    this.setState({lastSelected: index, selected: [index]});
  }

  private doDoubleClickTrack(index: number): void {
    const track = this.state.tracks[index];
    const playlist = new RandomTrackPlaylist(this.state.tracks);
    playlist.addTrack(track);
    this.props.setPlaylist(playlist, /* play= */ true);
  }

  private sort({sortBy, sortDirection}: {sortBy: string; sortDirection: Sort}): void {
    const tracks = this.sortTracks(sortBy, sortDirection);
    const selectedNow = this.state.selected.map((index) => {
      return this.state.tracks[index];
    });
    const selected = selectedNow.map((track) => {
      return tracks.indexOf(track);
    }).filter((num) => num >= 0);
    this.setState({sortBy, sortDirection, tracks, selected});
  }

  private onSearch(search: string): void {
    this.setState({search}, () => this.sort(this.state));
  }

  private closeEdit(): void {
    this.setState({editing: false});
  }
}

function mapStateToProps(store: RootState): StateProps {
  return {
    getAlbumsByIds: (ids: string[]) => getAlbumsByIds(store, ids),
    getArtistsByIds: (ids: string[]) => getArtistsByIds(store, ids),
    getGenresByIds: (ids: string[]) => getGenresByIds(store, ids).map((genre) => genre.name),
    playlists: getPlaylists(store),
    currentlyPlayingId: getCurrentTrackId(store),
    runGeniusExtension: (ids: string[]) => runGeniusExtension(store, ids),
  };
}

export default connect(mapStateToProps, {setPlaylist, updateLibrary, updateTrack, addToPlaylist})(TrackPicker);
