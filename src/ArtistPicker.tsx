import {Artist} from './redux/actionTypes';
import ArtistInfo from './ArtistInfo';
import React from 'react';
import SearchBar from './SearchBar';
import WrappedGrid from './WrappedGrid';

interface ArtistPickerState {
  search: string;
  sortedArtists: Artist[];
  withErrors: boolean;
}

interface ArtistPickerProps {
  artists: Artist[];
  goToArtist(artistId: string): void;
}

export default class ArtistPicker extends React.Component<ArtistPickerProps, ArtistPickerState> {
  private numCols: number;

  constructor(props: ArtistPickerProps) {
    super(props);
    this.state = {
      search: '',
      sortedArtists: [],
      withErrors: false,
    };

    this.numCols = 0;
  }

  public componentDidMount(): void {
    this.setState({sortedArtists: this.sortArtists(this.props.artists)});
  }

  public componentDidUpdate(): void {
    const sortedArtists = this.sortArtists(this.props.artists);
    if (sortedArtists.length !== this.state.sortedArtists.length ||
      sortedArtists.some((artist, index) => {
        return this.state.sortedArtists[index] !== artist;
    })) {
      this.setState({sortedArtists});
    }
  }

  public render(): JSX.Element {
    const items = this.state.sortedArtists;
    return (
      <div className="main">
        <button onClick={() => this.withErrors()}>Show Wiki Status</button>
        <SearchBar onSearch={(search) => this.onSearch(search)} />
        <WrappedGrid
          cellRenderer={this.cellRenderer.bind(this)}
          numItems={items.length}
        />
      </div>
    );
  }

  private sortArtists(artists: Artist[]): Artist[] {
    return artists.filter((artist) => {
      if (this.state.search) {
        return artist.name.toLowerCase().includes(this.state.search.toLowerCase());
      }
      return true;
    }).sort((artist1, artist2) => {
      return artist1.name.localeCompare(artist2.name);
    });
  }

  private goToArtist(artistId: string): void {
    this.props.goToArtist(artistId);
  }

  private cellRenderer(index: number, key: string, style: React.CSSProperties): JSX.Element {
    const artists = this.state.sortedArtists;
    return (
      <ArtistInfo
        artist={artists[index]}
        goToArtist={(artist) => this.goToArtist(artist)}
        key={key}
        style={style}
        showStatus={this.state.withErrors}
      />
    );
  }

  private withErrors(): void {
    this.setState({withErrors: !this.state.withErrors});
  }

  private onSearch(search: string): void {
    this.setState({search});
  }
}
