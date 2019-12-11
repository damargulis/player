import AutoComplete from './AutoComplete';
import React from 'react';

import './SongEditer.css';

export default class SongEditer extends React.Component {
  constructor(props) {
    super(props);

    const genres = this.props.library.getGenresByIds(
      this.props.tracks[0].genreIds);
    this.state = { genres };

    this.name = React.createRef();
    this.year = React.createRef();
    this.favorites = React.createRef();
    this.playCount = React.createRef();
  }

  save() {
    const track = this.props.tracks[0];
    track.name = this.name.current.value;
    track.year = this.year.current.value;
    track.favorites = this.favorites.current.value.split(', ').map(
      (num) => parseInt(num));
    track.genreIds = this.props.library.getGenreIds(this.state.genres);
    track.playCount = this.playCount.current.value;
    this.props.library.save();
    this.props.exit();
  }

  addGenre(genre) {
    const genres = this.state.genres;
    genres.push(genre);
    this.setState({genres});
  }

  removeGenre(index) {
    const genres = this.state.genres;
    genres.splice(index, 1);
    this.setState({genres});
  }

  getGenres() {
    const genres = this.state.genres;
    return genres.map((genre, index) => {
      return (
        <div className="list-item" key={index}>
          {genre}
          <span onClick={() => this.removeGenre(index)} className="close">
            X
          </span>
        </div>
      );
    });
  }

  render() {
    const track = this.props.tracks[0];
    const artists = this.props.library.getArtistsByIds(track.artistIds)
      .map(artist => artist.name).join(', ');
    const albums = this.props.library.getAlbumsByIds(track.albumIds)
      .map(album => album.name).join(', ');
    const favoriteYears = track.favorites.sort().join(', ');
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
        <div className="edit-container">
          <label className="label" >Artists: </label>
          <input
            defaultValue={artists}
            className="input"
            placeholder="Artists"
          />
        </div>
        <div className="edit-container">
          <label className="label">Albums: </label>
          <input defaultValue={albums} className="input" placeholder="Albums"/>
        </div>
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
        <div className="edit-container">
          <label className="label">Genres: </label>
          {
            this.getGenres()
          }
          <AutoComplete
            onSubmit={this.addGenre.bind(this)}
            suggestions={this.props.library.getGenres()}
          />
        </div>
        <div className="edit-container">
          <label className="label">Years Favorited: </label>
          <input
            ref={this.favorites}
            className="input"
            defaultValue={favoriteYears}
          />
        </div>
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
