import Artist from "./library/Artist";
import ArtistInfo from "./ArtistInfo";
import Library from "./library/Library";
import React from "react";
import SearchBar from "./SearchBar";
import WrappedGrid from "./WrappedGrid";

interface ArtistPickerState {
  search: string;
  sortedArtists: Artist[];
  withErrors: boolean;
}

interface ArtistPickerProps {
  artists: Artist[];
  goToArtist: (artist: Artist) => void;
  library: Library;
}

export default class ArtistPicker extends React.Component<ArtistPickerProps, ArtistPickerState> {
  private numCols: number;

  constructor(props: ArtistPickerProps) {
    super(props);
    this.state = {
      search: "",
      sortedArtists: [],
      withErrors: false,
    };

    this.numCols = 0;
  }

  public componentDidMount() {
    this.setState({
      sortedArtists: this.sortArtists(this.props.artists),
    });
  }

  public componentDidUpdate() {
    const sortedArtists = this.sortArtists(this.props.artists);
    if (sortedArtists.length !== this.state.sortedArtists.length ||
      sortedArtists.some((artist, index) => {
        return this.state.sortedArtists[index] !== artist;
      })) {
      this.setState({
        sortedArtists,
      });
    }
  }

  // reuse the grid from album view?
  // source pictures from wikipedia, rotate album covers as backup
  public render() {
    const items = this.state.withErrors
      ? this.state.sortedArtists.filter((artist) => {
        return artist.errors.length > 0;
      }) : this.state.sortedArtists;
    return (
      <div className="main">
        <button onClick={() => this.withErrors()}>With Errors Only</button>
        <SearchBar onSearch={(search) => this.onSearch(search)} />
        <WrappedGrid
          cellRenderer={this.cellRenderer.bind(this)}
          numItems={items.length}
        />
      </div>
    );
  }

  private sortArtists(artists: Artist[]) {
    return artists.filter((artist) => {
      if (this.state.search) {
        return artist.name.toLowerCase()
          .includes(this.state.search.toLowerCase());
      }
      return true;
    }).sort((artist1, artist2) => {
      return artist1.name.localeCompare(artist2.name);
    });
  }

  private goToArtist(artist: Artist) {
    this.props.goToArtist(artist);
  }

  private cellRenderer(index: number, key: string, style: {width: number, backgroundColor: string}) {
    const artists = this.state.withErrors
      ? this.state.sortedArtists.filter((artist) => {
        return artist.errors.length > 0;
      }) : this.state.sortedArtists;
    return (
      <ArtistInfo
        artist={artists[index]}
        goToArtist={(artist) => this.goToArtist(artist)}
        key={key}
        library={this.props.library}
        style={style}
      />
    );
  }

  private withErrors() {
    this.setState({
      withErrors: !this.state.withErrors,
    });
  }

  private onSearch(search: string) {
    this.setState({search});
  }
}
