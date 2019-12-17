import AlbumAttributeEditor from './AlbumAttributeEditor';
import ArtistAttributeEditor from './ArtistAttributeEditor';
import FavoritesAttributeEditor from './FavoritesAttributeEditor';
import GenreAttributeEditor from './GenreAttributeEditor';
import Library from './library/Library';
import PropTypes from 'prop-types';
import React from 'react';
import ToggableEditableAttribute from './ToggableEditableAttribute';
import Track from './library/Track';

export default class MultipleSongEditer extends React.Component {
  constructor(props) {
    super(props);

    // TODO: smarter defaults?
    this.state = {
      genreIds: [],
      editGenre: false,
      artistIds: [],
      editArtists: false,
      editAlbums: false,
      albumIds: [],
      editFavorites: false,
      yearsFavorited: [],
      editYear: false,
      editPlayCount: false,
    };

    this.year = React.createRef();
    this.playCount = React.createRef();
  }

  editGenre(evt) {
    this.setState({editGenre: evt.target.checked});
  }

  editArtists(evt) {
    this.setState({editArtists: evt.target.checked});
  }

  editFavorites(evt) {
    this.setState({editFavorites: evt.target.checked});
  }

  editYear(evt) {
    this.setState({editYear: evt.target.checked});
  }

  editPlayCount(evt) {
    this.setState({editPlayCount: evt.target.checked});
  }

  editAlbums(evt) {
    this.setState({editAlbums: evt.target.checked});
  }

  saveTrack(track) {
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
    if (this.state.editYear) {
      track.year = this.year.current.value;
    }
    if (this.state.editPlayCount) {
      track.playCount = this.playCount.current.value;
    }
  }

  save() {
    this.props.tracks.forEach((track) => {
      this.saveTrack(track);
    });
    this.props.library.save();
    this.props.exit();
  }

  render() {
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
}

MultipleSongEditer.propTypes = {
  exit: PropTypes.func.isRequired,
  library: PropTypes.instanceOf(Library).isRequired,
  tracks: PropTypes.arrayOf(PropTypes.instanceOf(Track)).isRequired,
};
