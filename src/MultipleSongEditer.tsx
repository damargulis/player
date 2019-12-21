import AlbumAttributeEditor from "./AlbumAttributeEditor";
import ArtistAttributeEditor from "./ArtistAttributeEditor";
import FavoritesAttributeEditor from "./FavoritesAttributeEditor";
import GenreAttributeEditor from "./GenreAttributeEditor";
import Library from "./library/Library";
import React from "react";
import ToggableEditableAttribute from "./ToggableEditableAttribute";
import Track from "./library/Track";

interface MultipleSongEditerProps {
  library: Library;
  tracks: Track[];
  exit(): void;
}

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

export default class MultipleSongEditer extends React.Component<MultipleSongEditerProps, MultipleSongEditerState> {
  private year = React.createRef<HTMLInputElement>();
  private playCount = React.createRef<HTMLInputElement>();

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
          <ArtistAttributeEditor
            artistIds={this.state.artistIds}
            library={this.props.library}
          />
        </ToggableEditableAttribute>
        <ToggableEditableAttribute
          editing={this.state.editAlbums}
          label="Albums"
          toggleEdit={this.editAlbums.bind(this)}
        >
          <AlbumAttributeEditor
            albumIds={this.state.albumIds}
            library={this.props.library}
          />
        </ToggableEditableAttribute>
        <ToggableEditableAttribute
          editing={this.state.editYear}
          label="Year"
          toggleEdit={this.editYear.bind(this)}
        >
          <div className="edit-container">
            <label className="label">Year: </label>
            <input
              className="input"
              placeholder="Year"
              ref={this.year}
              type="number"
            />
          </div>
        </ToggableEditableAttribute>
        <ToggableEditableAttribute
          editing={this.state.editGenre}
          label="Genres"
          toggleEdit={this.editGenre.bind(this)}
        >
          <GenreAttributeEditor
            genreIds={this.state.genreIds}
            library={this.props.library}
          />
        </ToggableEditableAttribute>
        <ToggableEditableAttribute
          editing={this.state.editFavorites}
          label="Favorite Years"
          toggleEdit={this.editFavorites.bind(this)}
        >
          <FavoritesAttributeEditor
            yearsFavorited={this.state.yearsFavorited}
          />
        </ToggableEditableAttribute>
        <ToggableEditableAttribute
          editing={this.state.editPlayCount}
          label="Play Count"
          toggleEdit={this.editPlayCount.bind(this)}
        >
          <div className="edit-container">
            <label className="label">Play Count: </label>
            <input
              className="input"
              placeholder="Play Count"
              ref={this.playCount}
              type="number"
            />
          </div>
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
      this.state.artistIds.forEach((artistId) => {
        if (!track.artistIds.includes(artistId)) {
          const artist = this.props.library.getArtistById(artistId);
          artist.trackIds.push(track.id);
        }
      });
      track.artistIds = this.state.artistIds;
    }
    if (this.state.editAlbums) {
      this.state.albumIds.forEach((albumId) => {
        if (!track.albumIds.includes(albumId)) {
          const album = this.props.library.getAlbumById(albumId);
          album.trackIds.push(track.id);
        }
      });
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
    this.props.library.save();
    this.props.exit();
  }
}
