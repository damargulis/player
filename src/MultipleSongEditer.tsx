import {save} from './redux/actions';
import Album from './library/Album';
import AlbumAttributeEditor from './AlbumAttributeEditor';
import Artist from './library/Artist';
import ArtistAttributeEditor from './ArtistAttributeEditor';
import AttributeEditer from './AttributeEditer';
import FavoritesAttributeEditor from './FavoritesAttributeEditor';
import GenreAttributeEditor from './GenreAttributeEditor';
import React from 'react';
import {connect} from 'react-redux';
import {getAlbumById, getArtistById} from './redux/selectors';
import {RootState} from './redux/store';
import ToggableEditableAttribute from './ToggableEditableAttribute';
import Track from './library/Track';
import {setMemberIds} from './utils';

interface DispatchProps {
  save(): void;
}

interface StateProps {
  getArtistById(id: number): Artist;
  getAlbumById(id: number): Album;
}

interface OwnProps {
  tracks: Track[];
  exit(): void;
}

type MultipleSongEditerProps = StateProps & OwnProps & DispatchProps;

interface MultipleSongEditerState {
  editGenre: boolean;
  genreIds: number[];
  artistIds: number[];
  editArtists: boolean;
  editAlbums: boolean;
  albumIds: number[];
  editFavorites: boolean;
  yearsFavorited: number[];
  editYear: boolean;
  editPlayCount: boolean;
}

class MultipleSongEditer extends React.Component<MultipleSongEditerProps, MultipleSongEditerState> {
  private year = React.createRef<AttributeEditer>();
  private playCount = React.createRef<AttributeEditer>();

  constructor(props: MultipleSongEditerProps) {
    super(props);

    // TODO: smarter defaults?
    this.state = {
      albumIds: [],
      artistIds: [],
      editAlbums: false,
      editArtists: false,
      editFavorites: false,
      editGenre: false,
      editPlayCount: false,
      editYear: false,
      genreIds: [],
      yearsFavorited: [],
    };

    this.year = React.createRef();
    this.playCount = React.createRef();
  }

  public render(): JSX.Element {
    return (
      <div>
        <h3 className="title">Edit Tracks</h3>
        <ToggableEditableAttribute
          editing={this.state.editArtists}
          label="Artists"
          toggleEdit={this.editArtists.bind(this)}
        >
          <ArtistAttributeEditor artistIds={this.state.artistIds} />
        </ToggableEditableAttribute>
        <ToggableEditableAttribute
          editing={this.state.editAlbums}
          label="Albums"
          toggleEdit={this.editAlbums.bind(this)}
        >
          <AlbumAttributeEditor albumIds={this.state.albumIds} />
        </ToggableEditableAttribute>
        <ToggableEditableAttribute
          editing={this.state.editYear}
          label="Year"
          toggleEdit={this.editYear.bind(this)}
        >
          <AttributeEditer name="Year" ref={this.year} />
        </ToggableEditableAttribute>
        <ToggableEditableAttribute
          editing={this.state.editGenre}
          label="Genres"
          toggleEdit={this.editGenre.bind(this)}
        >
          <GenreAttributeEditor genreIds={this.state.genreIds} />
        </ToggableEditableAttribute>
        <ToggableEditableAttribute
          editing={this.state.editFavorites}
          label="Favorite Years"
          toggleEdit={this.editFavorites.bind(this)}
        >
          <FavoritesAttributeEditor yearsFavorited={this.state.yearsFavorited} />
        </ToggableEditableAttribute>
        <ToggableEditableAttribute
          editing={this.state.editPlayCount}
          label="Play Count"
          toggleEdit={this.editPlayCount.bind(this)}
        >
          <AttributeEditer name="Play Count" ref={this.playCount} />
        </ToggableEditableAttribute>
        <div className="bottom-bar">
          <button onClick={this.save.bind(this)}>Save</button>
          <button onClick={this.props.exit}>Cancel</button>
        </div>
      </div>
    );
  }

  private editGenre(editing: boolean): void {
    this.setState({editGenre: editing});
  }

  private editArtists(editing: boolean): void {
    this.setState({editArtists: editing});
  }

  private editFavorites(editing: boolean): void {
    this.setState({editFavorites: editing});
  }

  private editYear(editing: boolean): void {
    this.setState({editYear: editing});
  }

  private editPlayCount(editing: boolean): void {
    this.setState({editPlayCount: editing});
  }

  private editAlbums(editing: boolean): void {
    this.setState({editAlbums: editing});
  }

  private saveTrack(track: Track): void {
    if (this.state.editGenre) {
     track.genreIds = this.state.genreIds;
    }
    if (this.state.editArtists) {
     setMemberIds(track.id, this.state.artistIds, track.artistIds, (id) => this.props.getArtistById(id).trackIds);
     track.artistIds = this.state.artistIds;
    }
    if (this.state.editAlbums) {
     setMemberIds(track.id, this.state.albumIds, track.albumIds, (id) => this.props.getAlbumById(id).trackIds);
     track.albumIds = this.state.albumIds;
    }
    if (this.state.editFavorites) {
     track.favorites = this.state.yearsFavorited;
    }
    const year = this.year.current;
    if (this.state.editYear && year) {
     track.year = parseInt(year.value, 10);
    }
    const playCount = this.playCount.current;
    if (this.state.editPlayCount && playCount) {
     track.playCount = parseInt(playCount.value, 10);
    }
  }

  private save(): void {
    this.props.tracks.forEach((track) => {
      this.saveTrack(track);
    });
    this.props.save();
    this.props.exit();
  }
}

function mapStateToProps(store: RootState): StateProps {
  return {
    getAlbumById: (id: number) => getAlbumById(store, id),
    getArtistById: (id: number) => getArtistById(store, id),
  };
}

export default connect(mapStateToProps, {save})(MultipleSongEditer);
