import AttributeList from './AttributeList';
import Library from './library/Library';
import PropTypes from 'prop-types';
import React from 'react';

import './SongEditer.css';

export default class SongEditer extends React.Component {
  constructor(props) {
    super(props);
    // TODO: handle multiple tracks -- wrap this?
    const track = this.props.tracks[0];

    this.state = {
      genreIds: [...track.genreIds],
      albumIds: [...track.albumIds],
      artistIds: [...track.artistIds],
      yearsFavorited: [...track.favorites],
    };

    this.name = React.createRef();
    this.year = React.createRef();
    this.playCount = React.createRef();
  }

  save() {
    const track = this.props.tracks[0];
    track.name = this.name.current.value;
    track.year = this.year.current.value;
    track.playCount = this.playCount.current.value;
    track.favorites = this.state.yearsFavorited;
    track.genreIds = this.state.genreIds;
    this.state.albumIds.forEach((albumId) => {
      if (!track.albumIds.includes(albumId)) {
        const album = this.props.library.getAlbumById(albumId);
        album.trackIds.push(track.id);
      }
    });
    track.albumIds = this.state.albumIds;
    this.state.artistIds.forEach((artistId) => {
      if (!track.artistIds.includes(artistId)) {
        const artist = this.props.library.getArtistById(artistId);
        artist.trackIds.push(track.id);
      }
    });
    track.artistIds = this.state.artistIds;

    this.props.library.save();
    this.props.exit();
  }

  render() {
    const track = this.props.tracks[0];
    return (
      <div>
        <h3 className="title">
          Edit Track{this.props.tracks.length > 1 ? 's' : ''}
        </h3>
        <div className="edit-container">
          <label className="label" >Name: </label>
          <input
            className="input"
            defaultValue={track.name}
            placeholder="Name"
            ref={this.name}
          />
        </div>
        <AttributeList
          attributes={this.state.artistIds}
          getDisplayName={(artistId) => {
            return this.props.library.getArtistById(artistId).name;
          }}
          label="Artists"
          searchFilter={(input, suggest) => {
            const artist = this.props.library.getArtistById(suggest);
            return artist.name.toLowerCase().indexOf(input.toLowerCase()) > -1;
          }}
          suggestions={
            this.props.library.getArtists().map((artist) => artist.id)
          }
        />
        <AttributeList
          attributes={this.state.albumIds}
          getDisplayName={(albumId) => {
            return this.props.library.getAlbumById(albumId).name;
          }}
          label="Albums"
          searchFilter={(input, suggest) => {
            const album = this.props.library.getAlbumById(suggest);
            // todo: include artist, genre etc in search
            return album.name.toLowerCase().indexOf(input.toLowerCase()) > -1;
          }}
          suggestions={this.props.library.getAlbums().map((album) => album.id)}
        />
        <div className="edit-container">
          <label className="label" >Year: </label>
          <input
            className="input"
            defaultValue={track.year}
            placeholder="Year"
            ref={this.year}
            type="number"
          />
        </div>
        <AttributeList
          attributes={this.state.genreIds}
          getDisplayName={(genreId) => this.props.library.getGenreById(genreId)}
          label="Genres"
          searchFilter={(input, suggest) => {
            const genre = this.props.library.getGenreById(suggest);
            return genre.toLowerCase().indexOf(input.toLowerCase()) > -1;
          }}
          suggestions={[...Array(this.props.library.getGenres().length).keys()]}
        />
        <AttributeList
          attributes={this.state.yearsFavorited}
          getDisplayName={(year) => year}
          // TODO: better way of suggesting years
          label="Years Favorited"
          // TODO: make this the default
          searchFilter={(input, year) => {
            return year.toString().toLowerCase().indexOf(
              input.toLowerCase()) > -1;
          }}
          suggestions={[2015, 2016, 2017, 2018, 2019]}
        />
        <div className="edit-container">
          <label className="label">Play Count:</label>
          <input
            className="input"
            defaultValue={track.playCount}
            ref={this.playCount}
            type="number"
          />
        </div>
        <div className="bottom-bar">
          <button onClick={this.save.bind(this)}>Save</button>
          <button onClick={this.props.exit}>Cancel</button>
        </div>
      </div>
    );
  }
}

SongEditer.propTypes = {
  exit: PropTypes.func.isRequired,
  library: PropTypes.instanceOf(Library).isRequired,
  tracks: PropTypes.array.isRequired,
};
