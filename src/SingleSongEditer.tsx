import {save} from "./redux/actions";
import Album from "./library/Album";
import AlbumAttributeEditor from "./AlbumAttributeEditor";
import Artist from "./library/Artist";
import ArtistAttributeEditor from "./ArtistAttributeEditor";
import FavoritesAttributeEditor from "./FavoritesAttributeEditor";
import GenreAttributeEditor from "./GenreAttributeEditor";
import React from "react";
import {connect} from "react-redux";
import {getAlbumById, getArtistById} from "./redux/selectors";
import {RootState} from "./redux/store";
import Track from "./library/Track";

interface StateProps {
  getAlbumById(albumId: number): Album;
  getArtistById(artistId: number): Artist;
}

interface OwnProps {
  track: Track;
  exit(): void;
}

interface DispatchProps {
  save(): void;
}

type SingleSongEditerProps = StateProps & OwnProps & DispatchProps;

interface SingleSongEditerState {
  genreIds: number[];
  albumIds: number[];
  artistIds: number[];
  yearsFavorited: number[];
}

class SingleSongEditer extends React.Component<SingleSongEditerProps, SingleSongEditerState> {
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
    const track = this.props.track;
    if (this.name.current) {
     track.name = this.name.current.value;
    }
    if (this.year.current) {
     track.year = parseInt(this.year.current.value, 10);
    }
    if (this.playCount.current) {
     track.playCount = parseInt(this.playCount.current.value, 10);
    }
    track.favorites = this.state.yearsFavorited;
    track.genreIds = this.state.genreIds;
    this.state.albumIds.forEach((albumId) => {
     if (!track.albumIds.includes(albumId)) {
       const album = this.props.getAlbumById(albumId);
       album.trackIds.push(track.id);
     }
    });
    track.albumIds = this.state.albumIds;
    this.state.artistIds.forEach((artistId) => {
     if (!track.artistIds.includes(artistId)) {
       const artist = this.props.getArtistById(artistId);
       artist.trackIds.push(track.id);
     }
    });
    track.artistIds = this.state.artistIds;

    this.props.save();
    this.props.exit();
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

function mapStateToProps(state: RootState): StateProps {
  return {
    getAlbumById: (id: number) => getAlbumById(state, id),
    getArtistById: (id: number) => getArtistById(state, id),
  };
}

export default connect(mapStateToProps, {save})(SingleSongEditer);
