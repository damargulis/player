import AlbumAttributeEditor from "./AlbumAttributeEditor";
import ArtistAttributeEditor from "./ArtistAttributeEditor";
import FavoritesAttributeEditor from "./FavoritesAttributeEditor";
import GenreAttributeEditor from "./GenreAttributeEditor";
import React from "react";
import Track from "./library/Track";

interface SingleSongEditerProps {
  track: Track;
  exit(): void;
}

interface SingleSongEditerState {
  genreIds: number[];
  albumIds: number[];
  artistIds: number[];
  yearsFavorited: number[];
}

export default class SingleSongEditer extends React.Component<SingleSongEditerProps, SingleSongEditerState> {
  private name = React.createRef<HTMLInputElement>();
  private year = React.createRef<HTMLInputElement>();
  private playCount = React.createRef<HTMLInputElement>();

  constructor(props: SingleSongEditerProps) {
    super(props);
    const track = this.props.track;

    this.state = {
      albumIds: [...track.albumIds],
      artistIds: [...track.artistIds],
      genreIds: [...track.genreIds],
      yearsFavorited: [...track.favorites],
    };
  }

  public save(): void {
    // TODO: turn into action
    // const track = this.props.track;
    // if (this.name.current) {
    //  track.name = this.name.current.value;
    // }
    // if (this.year.current) {
    //  track.year = parseInt(this.year.current.value, 10);
    // }
    // if (this.playCount.current) {
    //  track.playCount = parseInt(this.playCount.current.value, 10);
    // }
    // track.favorites = this.state.yearsFavorited;
    // track.genreIds = this.state.genreIds;
    // this.state.albumIds.forEach((albumId) => {
    //  if (!track.albumIds.includes(albumId)) {
    //    const album = this.props.library.getAlbumById(albumId);
    //    album.trackIds.push(track.id);
    //  }
    // });
    // track.albumIds = this.state.albumIds;
    // this.state.artistIds.forEach((artistId) => {
    //  if (!track.artistIds.includes(artistId)) {
    //    const artist = this.props.library.getArtistById(artistId);
    //    artist.trackIds.push(track.id);
    //  }
    // });
    // track.artistIds = this.state.artistIds;

    // this.props.library.save();
    // this.props.exit();
  }

  public render(): JSX.Element {
    const track = this.props.track;
    return (
      <div>
        <h3 className="title">Edit Track</h3>
        <div className="edit-container">
          <label className="label" >Name: </label>
          <input
            className="input"
            defaultValue={track.name}
            placeholder="Name"
            ref={this.name}
          />
        </div>
        <ArtistAttributeEditor artistIds={this.state.artistIds} />
        <AlbumAttributeEditor albumIds={this.state.albumIds} />
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
        <GenreAttributeEditor genreIds={this.state.genreIds} />
        <FavoritesAttributeEditor
          yearsFavorited={this.state.yearsFavorited}
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
