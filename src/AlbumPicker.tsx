import {Album, Artist} from './redux/actionTypes';
import AlbumEditor from './AlbumEditor';
import AlbumInfo from './AlbumInfo';
import * as React from 'react';
import Modal from 'react-modal';
import {connect} from 'react-redux';
import SearchBar from './SearchBar';
import {getArtistsByIds} from './redux/selectors';
import shortid from 'shortid';
import {RootState} from './redux/store';
import WrappedGrid from './WrappedGrid';

import './App.css';

// see: http://reactcommunity.org/react-modal/accessibility/#app-element
Modal.setAppElement('#root');

interface OwnProps {
  albums: Album[];
  scrollPosition?: number;
  goToAlbum(albumId: string): void;
}

interface StateProps {
  getArtistsByIds(ids: string[]): Artist[];
}

type AlbumPickerProps = OwnProps & StateProps;

interface AlbumPickerState {
  addingAlbum: boolean;
  search?: string;
  reverse: boolean;
  sortedAlbums: Album[];
  withErrors: boolean;
  sortMethod(album1: Album, album2: Album): number;
}

class AlbumPicker extends React.Component<AlbumPickerProps, AlbumPickerState> {
  private numCols: number;

  constructor(props: AlbumPickerProps) {
    super(props);

    this.sortByName = this.sortByName.bind(this);
    this.sortByYear = this.sortByYear.bind(this);
    this.sortByArtist = this.sortByArtist.bind(this);

    this.state = {
      addingAlbum: false,
      reverse: false,
      search: undefined,
      sortMethod: this.sortByName,
      sortedAlbums: [],
      withErrors: false,
    };
    this.numCols = 0;
  }

  public sortAlbums(albums: Album[]): Album[] {
    return albums.filter((album) => {
      if (!this.state.search) {
        return true;
      }
      return album.name.includes(this.state.search);
    }).sort((album1, album2) => {
      if (this.state.reverse) {
        return this.state.sortMethod(album2, album1);
      }
      return this.state.sortMethod(album1, album2);
    });
  }

  public componentDidMount(): void {
    this.setState({sortedAlbums: this.sortAlbums(this.props.albums)});
  }

  public componentDidUpdate(): void {
    const sortedAlbums = this.sortAlbums(this.props.albums);
    if (sortedAlbums.length !== this.state.sortedAlbums.length ||
      sortedAlbums.some((album, index) => {
        return this.state.sortedAlbums[index] !== album;
      })) {
      this.setState({sortedAlbums});
    }
  }

  public render(): JSX.Element {
    const items = this.state.sortedAlbums;
    // TODO: change wiki status to be generic extension with like list of dots instead of background
    // These should persist (along with scroll height) when you click back.
    // Should reset if you reclick album on the left.
    return (
      <div className="main" >
        <Modal isOpen={this.state.addingAlbum} onRequestClose={this.closeAddAlbum.bind(this)}>
          <AlbumEditor exit={this.closeAddAlbum.bind(this)} album={{
            id: shortid.generate(),
              warnings: {},
              errors: [],
              artistIds: [],
              name: '',
              trackIds: [],
              year: 0,
              genreIds: [],
              playCount: 0,
              skipCount: 0,
              favorites: [],
          }} />
        </Modal>
        <div id="sortPicker" style={{textAlign: 'center'}}>
          <button onClick={() => this.chooseSort(this.sortByName)}>Name</button>
          <button onClick={() => this.chooseSort(this.sortByArtist)}>Artist</button>
          <button onClick={() => this.chooseSort(this.sortByYear)}>Year</button>
          <button onClick={() => this.withErrors()}>Show Wiki Status</button>
          <SearchBar onSearch={(search: string) => this.onSearch(search)} />
          <button onClick={() => this.addAlbum()}>+</button>
        </div>
        <WrappedGrid
          cellRenderer={this.cellRenderer.bind(this)}
          numItems={items.length}
          scrollTop={this.props.scrollPosition}
        />
      </div>
    );
  }

  private goToAlbum(album: Album): void {
    this.props.goToAlbum(album.id);
  }

  private addAlbum(): void {
    this.setState({addingAlbum: true});
  }

  private closeAddAlbum(): void {
    this.setState({addingAlbum: false});
  }

  private cellRenderer(index: number, key: string, style: React.CSSProperties): JSX.Element {
    const albums = this.state.sortedAlbums;
    return (
      <AlbumInfo
        showStatus={this.state.withErrors}
        album={albums[index]}
        goToAlbum={(album) => this.goToAlbum(album)}
        key={key}
        style={style}
      />
    );
  }

  private sortByName(album1: Album, album2: Album): number {
    return album1.name.localeCompare(album2.name);
  }

  private sortByArtist(album1: Album, album2: Album): number {
    const artist1 = this.props.getArtistsByIds(album1.artistIds)
      .map((artist: Artist) => artist.name).join(',');
    const artist2 = this.props.getArtistsByIds(album2.artistIds)
      .map((artist: Artist) => artist.name).join(',');
    return artist1.localeCompare(artist2);
  }

  private sortByYear(album1: Album, album2: Album): number {
    return album1.year - album2.year;
  }

  private chooseSort(sortMethod: (album1: Album, album2: Album) => number): void {
    if (sortMethod === this.state.sortMethod) {
      this.setState({reverse: !this.state.reverse});
    } else {
      this.setState({sortMethod});
    }
  }

  private withErrors(): void {
    this.setState({withErrors: !this.state.withErrors});
  }

  private onSearch(search: string): void {
    this.setState({search});
  }
}

function mapStateToProps(store: RootState): StateProps {
  return {
    getArtistsByIds: (ids: string[]) => getArtistsByIds(store, ids),
  };
}

export default connect(mapStateToProps)(AlbumPicker);
