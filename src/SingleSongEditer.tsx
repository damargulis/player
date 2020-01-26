import {updateTrack} from './redux/actions';
import {Album, Artist, Track, TrackInfo} from './redux/actionTypes';
import AlbumAttributeEditor from './AlbumAttributeEditor';
import ArtistAttributeEditor from './ArtistAttributeEditor';
import AttributeEditer from './AttributeEditer';
import FavoritesAttributeEditor from './FavoritesAttributeEditor';
import GenreAttributeEditor from './GenreAttributeEditor';
import React from 'react';
import {connect} from 'react-redux';
import {getAlbumById, getArtistById} from './redux/selectors';
import {RootState} from './redux/store';

interface StateProps {
  getAlbumById(albumId: number): Album;
  getArtistById(artistId: number): Artist;
}

interface OwnProps {
  track: Track;
  exit(): void;
}

interface DispatchProps {
  updateTrack(id: number, info: TrackInfo): void;
}

type SingleSongEditerProps = StateProps & OwnProps & DispatchProps;

interface SingleSongEditerState {
  genreIds: number[];
  albumIds: number[];
  artistIds: number[];
  yearsFavorited: number[];
}

class SingleSongEditer extends React.Component<SingleSongEditerProps, SingleSongEditerState> {
  private name = React.createRef<AttributeEditer>();
  private year = React.createRef<AttributeEditer>();
  private playCount = React.createRef<AttributeEditer>();

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
    this.props.updateTrack(this.props.track.id, {
      name: this.name.current ? this.name.current.value : undefined,
      year: this.year.current ? parseInt(this.year.current.value, 10) : undefined,
      playCount: this.playCount.current ? parseInt(this.playCount.current.value, 10) : undefined,
      favorites: this.state.yearsFavorited,
      genreIds: this.state.genreIds,
      albumIds: this.state.albumIds,
      artistIds: this.state.artistIds,
    });
    this.props.exit();
  }

  public render(): JSX.Element {
    const track = this.props.track;
    return (
      <div>
        <h3 className="title">Edit Track</h3>
        <AttributeEditer name="Name" val={track.name} ref={this.name} />
        <ArtistAttributeEditor artistIds={this.state.artistIds} />
        <AlbumAttributeEditor albumIds={this.state.albumIds} />
        <AttributeEditer name="Year" val={track.year} ref={this.year} />
        <GenreAttributeEditor genreIds={this.state.genreIds} />
        <FavoritesAttributeEditor yearsFavorited={this.state.yearsFavorited} />
        <AttributeEditer name="Play Count" val={track.playCount} ref={this.playCount} />
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

export default connect(mapStateToProps, {updateTrack})(SingleSongEditer);
