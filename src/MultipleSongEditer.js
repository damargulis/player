import AttributeList from './AttributeList';
import Library from './library/Library';
import PropTypes from 'prop-types';
import React from 'react';
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

  editAlbums(evt) {
    this.setState({editAlbums: evt.target.checked});
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
        {
          this.state.editArtists
            ? <AttributeList
              attributes={this.state.artistIds}
              getDisplayName={(artistId) => {
                return this.props.library.getArtistById(artistId).name;
              }}
              label="Artists"
              searchFilter={(input, suggest) => {
                const artist = this.props.library.getArtistById(suggest);
                const name = artist.name.toLowerCase();
                return name.indexOf(input.toLowerCase()) > -1;
              }}
              suggestions={
                this.props.library.getArtists().map((artist) => artist.id)
              }
            /> : null
        }
        <div>Edit Artists:
          <input onChange={this.editArtists.bind(this)} type="checkbox"/>
        </div>
        {
          this.state.editAlbums
            ? <AttributeList
              attributes={this.state.albumIds}
              getDisplayName={(albumId) => {
                return this.props.library.getAlbumById(albumId).name;
              }}
              label="Albums"
              searchFilter={(input, suggest) => {
                const album = this.props.library.getAlbumById(suggest);
                // todo: include artist, genre etc in search
                const name = album.name.toLowerCase();
                return name.indexOf(input.toLowerCase()) > -1;
              }}
              suggestions={
                this.props.library.getAlbums().map((album) => album.id)
              }
            /> : null
        }
        <div>Edit Albums:
          <input onChange={this.editAlbums.bind(this)} type="checkbox"/>
        </div>
        {
          this.state.editYear
            ? <div className="edit-container">
              <label className="label">Year: </label>
              <input
                className="input"
                placeholder="Year"
                ref={this.year}
                type="number"
              />
            </div> : null
        }
        <div>Edit Year:
          <input onChange={this.editYear.bind(this)} type="checkbox"/>
        </div>
        { this.state.editGenre
          ? <AttributeList
            attributes={this.state.genreIds}
            getDisplayName={
              (genreId) => this.props.library.getGenreById(genreId)
            }
            label="Genres"
            searchFilter={(input, suggest) => {
              const genre = this.props.library.getGenreById(suggest);
              return genre.toLowerCase().indexOf(input.toLowerCase()) > -1;
            }}
            suggestions={
              [...Array(this.props.library.getGenres().length).keys()]
            }
          /> : null
        }
        <div>Edit Genres:
          <input onChange={this.editGenre.bind(this)} type="checkbox"/>
        </div>
        {
          this.state.editFavorites
            ? <AttributeList
              attributes={this.state.yearsFavorited}
              getDisplayName={(year) => year}
              label="Years Favorited"
              searchFilter={(input, year) => {
                return year.toString().toLowerCase().indexOf(
                  input.toLowerCase()) > -1;
              }}
              suggestions={[2015, 2016, 2017, 2018, 2019]}
            /> : null
        }
        <div>Edit Years Favorited:
          <input onChange={this.editFavorites.bind(this)} type="checkbox"/>
        </div>
        {
          this.state.editPlayCount
            ? <div className="edit-container">
              <label className="label">Play Count: </label>
              <input
                className="input"
                placeholder="Play Count"
                ref={this.playCount}
                type="number"
              />
            </div> : null
        }
        <div>Edit Play Count:
          <input onChange={this.editPlayCount.bind(this)} type="checkbox"/>
        </div>
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
