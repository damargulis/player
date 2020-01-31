import {updateTrack} from './redux/actions';
import {Album, Artist, Track, TrackInfo} from './redux/actionTypes';
import AlbumAttributeEditor from './AlbumAttributeEditor';
import ArtistAttributeEditor from './ArtistAttributeEditor';
import AttributeEditor from './AttributeEditor';
import FavoritesAttributeEditor from './FavoritesAttributeEditor';
import GenreAttributeEditor from './GenreAttributeEditor';
import React from 'react';
import {connect} from 'react-redux';
import {getAlbumById, getArtistById} from './redux/selectors';
import {RootState} from './redux/store';
import ToggableEditableAttribute from './ToggableEditableAttribute';

interface DispatchProps {
  updateTrack(id: string, info: TrackInfo): void;
}

interface StateProps {
  getArtistById(id: string): Artist;
  getAlbumById(id: string): Album;
}

interface OwnProps {
  tracks: Track[];
  exit(): void;
}

type MultipleTrackEditorProps = StateProps & OwnProps & DispatchProps;

interface MultipleTrackEditorState {
  editGenre: boolean;
  genreIds: string[];
  artistIds: string[];
  editArtists: boolean;
  editAlbums: boolean;
  albumIds: string[];
  editFavorites: boolean;
  yearsFavorited: number[];
  editYear: boolean;
  editPlayCount: boolean;
}

class MultipleTrackEditor extends React.Component<MultipleTrackEditorProps, MultipleTrackEditorState> {
  private year = React.createRef<AttributeEditor>();
  private playCount = React.createRef<AttributeEditor>();

  constructor(props: MultipleTrackEditorProps) {
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
          <AttributeEditor name="Year" ref={this.year} />
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
          <AttributeEditor name="Play Count" ref={this.playCount} />
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
    this.props.updateTrack(track.id, {
      genreIds: this.state.genreIds,
      artistIds: this.state.editArtists ? this.state.artistIds : undefined,
      albumIds: this.state.editAlbums ? this.state.albumIds : undefined,
      favorites: this.state.editFavorites ? this.state.yearsFavorited : undefined,
      year: this.year.current && this.state.editYear ? parseInt(this.year.current.value, 10) : undefined,
      playCount: this.playCount.current && this.state.editPlayCount ?
        parseInt(this.playCount.current.value, 10) : undefined,
    });
  }

  private save(): void {
    this.props.tracks.forEach((track) => {
      this.saveTrack(track);
    });
    this.props.exit();
  }
}

function mapStateToProps(store: RootState): StateProps {
  return {
    getAlbumById: (id: string) => getAlbumById(store, id),
    getArtistById: (id: string) => getArtistById(store, id),
  };
}

export default connect(mapStateToProps, {updateTrack})(MultipleTrackEditor);
