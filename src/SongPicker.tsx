import {setPlaylist} from "./redux/actions";
import Album from "./library/Album";
import Artist from "./library/Artist";
import {remote} from "electron";
import EmptyPlaylist from "./playlist/EmptyPlaylist";
import RandomSongPlaylist from "./playlist/RandomSongPlaylist";
import React from "react";
import Modal from "react-modal";
import { connect } from "react-redux";
import {AutoSizer, Column, Table} from "react-virtualized";
import "react-virtualized/styles.css";
import SearchBar from "./SearchBar";
import {getAlbumsByIds, getArtistsByIds, getGenresByIds} from "./redux/selectors";
import SongEditer from "./SongEditer";
import {RootState} from "./redux/store";
import Track from "./library/Track";
import {toTime} from "./utils";

// see: http://reactcommunity.org/react-modal/accessibility/#app-element
Modal.setAppElement("#root");

type Sort = "ASC" | "DESC";

interface SongPickerState {
  sortBy: string;
  sortDirection: Sort;
  songs: Track[];
  selected: number[];
  lastSelected?: number;
  search: string;
  editing: boolean;
}

interface StateProps {
  getArtistsByIds(ids: number[]): Artist[];
  getAlbumsByIds(ids: number[]): Album[];
  getGenresByIds(ids: number[]): string[];
}

interface OwnProps {
  songs: Track[];
  scrollToSong?: Track;
  sortBy?: string;
}

interface DispatchProps {
  setPlaylist(playlist: EmptyPlaylist): void;
}

type SongPickerProps = StateProps & OwnProps & DispatchProps;

class SongPicker extends React.Component<SongPickerProps, SongPickerState> {
  constructor(props: SongPickerProps) {
    super(props);

    const sortDirection = "ASC";
    const sortBy = this.props.sortBy || "name";
    const songs = this.sortSongs(sortBy, sortDirection);

    this.state = {
      editing: false,
      search: "",
      // TODO: change to a set
      selected: [],
      songs,
      sortBy,
      sortDirection,
    };
  }

  public componentDidMount(): void {
    this.sort(this.state);
  }

  public componentDidUpdate(prevProps: SongPickerProps): void {
    if (prevProps.songs !== this.props.songs) {
      this.sort(this.state);
    }
  }

  public render(): JSX.Element {
    // do this by id or something instead, this kind of check is bad but needed
    // because object gets serialized from miniwindow -> maxwindow
    const scrollToSong = this.props.scrollToSong;
    const scrollTo = scrollToSong
      ? this.state.songs.findIndex((song) => {
        return song.id === scrollToSong.id;
      })
      : -1;
    const selectedSongs = this.state.selected.map((songId) => {
      return this.state.songs[songId];
    });
    return (
      <div className="main">
        <Modal isOpen={this.state.editing}
          onRequestClose={this.closeEdit.bind(this)}
        >
          <SongEditer
            exit={this.closeEdit.bind(this)}
            tracks={selectedSongs}
          />
        </Modal>
        <SearchBar onSearch={(search) => this.onSearch(search)} />
        <AutoSizer>
          {({height, width}) => {
            return (
              <Table
                headerHeight={30}
                height={height}
                onRowClick={this.onRowClick.bind(this)}
                onRowDoubleClick={this.onRowDoubleClick.bind(this)}
                onRowRightClick={this.doRowRightClick.bind(this)}
                rowClassName="songRow"
                rowCount={this.state.songs.length}
                rowGetter={({index}) => this.getSongData(index)}
                rowHeight={15}
                rowStyle={this.getRowStyle.bind(this)}
                scrollToIndex={scrollTo}
                sort={this.sort.bind(this)}
                sortBy={this.state.sortBy}
                sortDirection={this.state.sortDirection}
                width={width}
              >
                <Column
                  dataKey="index"
                  label="Index"
                  width={50}
                />
                <Column
                  dataKey="name"
                  label="Name"
                  width={300}
                />
                <Column
                  dataKey="duration"
                  label="Time"
                  width={50}
                />
                <Column
                  dataKey="artists"
                  label="Artists"
                  width={150}
                />
                <Column
                  dataKey="albums"
                  label="Albums"
                  width={150}
                />
                <Column
                  dataKey="genres"
                  label="Genres"
                  width={100}
                />
                <Column
                  dataKey="year"
                  label="Year"
                  width={50}
                />
                <Column
                  dataKey="playCount"
                  label="Plays"
                  width={80}
                />
              </Table>
            );
          }}
        </AutoSizer>
      </div>
    );
  }

  private sortSongs(sortBy: string, sortDirection: string): Track[] {
    let songs = this.props.songs.slice().filter((song) => {
      if (this.state && this.state.search) {
        return song.name.toLowerCase()
          .includes(this.state.search.toLowerCase());
      }
      return true;
    });
    switch (sortBy) {
    case "index":
      break;
    case "name":
      songs = songs.sort((song1, song2) => {
        return song1.name.localeCompare(song2.name);
      });
      break;
    case "duration":
      songs = songs.sort((song1, song2) => {
        return song1.duration - song2.duration;
      });
      break;
    case "year":
      songs = songs.sort((song1, song2) => {
        return song1.year - song2.year;
      });
      break;
    case "playCount":
      songs = songs.sort((song1, song2) => {
        return song1.playCount - song2.playCount;
      });
      break;
    case "artists":
      songs = songs.sort((song1, song2) => {
        const artists1 = this.props.getArtistsByIds(song1.artistIds)
          .map((artist) => artist.name).join(", ");
        const artists2 = this.props.getArtistsByIds(song2.artistIds)
          .map((artist) => artist.name).join(", ");
        return artists1.localeCompare(artists2);
      });
      break;
    case "albums":
      songs = songs.sort((song1, song2) => {
        const albums1 = this.props.getAlbumsByIds(song1.albumIds)
          .map((album) => album.name).join(", ");
        const albums2 = this.props.getAlbumsByIds(song2.albumIds)
          .map((album) => album.name).join(", ");
        return albums1.localeCompare(albums2);
      });
      break;
    case "genres":
      songs = songs.sort((song1, song2) => {
        const genres1 = this.props.getGenresByIds(song1.genreIds)
          .join(", ");
        const genres2 = this.props.getGenresByIds(song2.genreIds)
          .join(", ");
        return genres1.localeCompare(genres2);
      });
      break;
    default:
      break;
    }
    if (sortDirection === "DESC") {
      songs = songs.reverse();
    }
    return songs;
  }

  private getSongData(index: number): object {
    const song = this.state.songs[index];
    // TODO: make album (maybe artist?) rotate
    return {
      albums: this.props.getAlbumsByIds(song.albumIds)
        .map((album) => album.name).join(", "),
      artists: this.props.getArtistsByIds(song.artistIds)
        .map((artist) => artist.name).join(", "),
      duration: toTime(song.duration),
      genres: this.props.getGenresByIds(song.genreIds).join(", "),
      index: this.props.songs.indexOf(song) + 1,
      name: song.name,
      playCount: song.playCount,
      year: song.year,
    };
  }

  private getRowStyle({index}: {index: number}): React.CSSProperties {
    const style = {
      backgroundColor: index % 2 === 0 ? "white" : "lightgray",
      borderTop: "solid black 1px",
      fontSize: 10,
      userSelect: "none",
    } as React.CSSProperties;
    if (index === -1) {
      style.backgroundColor = "gray";
    }
    if (this.state.selected.includes(index)) {
      style.backgroundColor = "#5e92e0";
    }
    return style;
  }

  private doShiftClick(index: number): void {
    if (!this.state.lastSelected) {
      this.doClickSong(index);
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
      const song = this.state.songs[id];
      if (song.favorites.indexOf(year) < 0) {
        song.favorites.push(year);
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

  private doRowRightClickNext(index: number): void {
    const menu = new remote.Menu();
    menu.append(
      new remote.MenuItem({label: "Edit Info", click: this.edit.bind(this)}));
    if (this.state.selected.length === 1) {
      menu.append(new remote.MenuItem({label: "Play", click: () => this.doDoubleClickSong(index)}));
    }
    menu.append(new remote.MenuItem({label: "Play Next", click: this.playNext.bind(this)}));
    menu.append(new remote.MenuItem({label: "Favorite", click: this.favorite.bind(this)}));
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
    this.setState({
      lastSelected: index,
      selected,
    });
  }

  private onRowClick({event, index}:
      {event: {ctrlKey: boolean, shiftKey: boolean, metaKey: boolean}, index: number}): void {
    if (event.shiftKey) {
      this.doShiftClick(index);
    } else if (event.metaKey || event.ctrlKey) {
      this.doCmdClick(index);
    } else {
      this.doClickSong(index);
    }
  }

  private onRowDoubleClick({event, index}:
    {event:
      {shiftKey: boolean, metaKey: boolean, ctrlKey: boolean}, index: number},
  ): void {
    if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
      this.doDoubleClickSong(index);
    }
  }

  private doClickSong(index: number): void {
    this.setState({
      lastSelected: index,
      selected: [index],
    });
  }

  private doDoubleClickSong(index: number): void {
    const song = this.state.songs[index];
    const playlist = new RandomSongPlaylist(this.state.songs);
    playlist.addSong(song);
    this.props.setPlaylist(playlist);
  }

  private sort({sortBy, sortDirection}: {sortBy: string, sortDirection: Sort}): void {
    const songs = this.sortSongs(sortBy, sortDirection);
    const selectedNow = this.state.selected.map((index) => {
      return this.state.songs[index];
    });
    const selected = selectedNow.map((song) => {
      return songs.indexOf(song);
    }).filter((num) => num >= 0);
    this.setState({sortBy, sortDirection, songs, selected});
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
    getAlbumsByIds: (ids: number[]) => getAlbumsByIds(store, ids),
    getArtistsByIds: (ids: number[]) => getArtistsByIds(store, ids),
    getGenresByIds: (ids: number[]) => getGenresByIds(store, ids),
  };
}

export default connect(mapStateToProps, {setPlaylist})(SongPicker);
