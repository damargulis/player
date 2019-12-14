import AttributeList from './AttributeList';
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
            ref={this.name}
            defaultValue={track.name}
            className="input"
            placeholder="Name"
          />
        </div>
        <AttributeList
          label="Artists"
          attributes={this.state.artistIds}
          suggestions={
            this.props.library.getArtists().map((artist) => artist.id)
          }
          getDisplayName={(artistId) => {
            return this.props.library.getArtistById(artistId).name;
          }}
          searchFilter={(input, suggest) => {
            const artist = this.props.library.getArtistById(suggest);
            return artist.name.toLowerCase().indexOf(input.toLowerCase()) > -1;
          }}
        />
        <AttributeList
          label="Albums"
          attributes={this.state.albumIds}
          suggestions={this.props.library.getAlbums().map((album) => album.id)}
          getDisplayName={(albumId) => {
            return this.props.library.getAlbumById(albumId).name;
          }}
          searchFilter={(input, suggest) => {
            const album = this.props.library.getAlbumById(suggest);
            // todo: include artist, genre etc in search
            return album.name.toLowerCase().indexOf(input.toLowerCase()) > -1;
          }}
        />
        <div className="edit-container">
          <label className="label" >Year: </label>
          <input
            ref={this.year}
            className="input"
            type="number"
            defaultValue={track.year}
            placeholder="Year"
          />
        </div>
        <AttributeList
          label="Genres"
          attributes={this.state.genreIds}
          suggestions={[...Array(this.props.library.getGenres().length).keys()]}
          getDisplayName={(genreId) => this.props.library.getGenreById(genreId)}
          searchFilter={(input, suggest) => {
            const genre = this.props.library.getGenreById(suggest);
            return genre.toLowerCase().indexOf(input.toLowerCase()) > -1;
          }}
        />
        <AttributeList
          label="Years Favorited"
          attributes={this.state.yearsFavorited}
          // TODO: better way of suggesting years
          suggestions={[2015, 2016, 2017, 2018, 2019]}
          // TODO: make this the default
          getDisplayName={(year) => year}
          searchFilter={(input, year) => {
            return year.toString().toLowerCase().indexOf(
              input.toLowerCase()) > -1;
          }}
        />
        <div className="edit-container">
          <label className="label">Play Count:</label>
          <input
            ref={this.playCount}
            className="input"
            defaultValue={track.playCount}
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
