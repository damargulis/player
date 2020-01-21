import {save} from './redux/actions';
import Album from './library/Album';
import AlbumAttributeEditor from './AlbumAttributeEditor';
import Artist from './library/Artist';
import ArtistAttributeEditor from './ArtistAttributeEditor';
import AttributeEditer from './AttributeEditer';
import FavoritesAttributeEditor from './FavoritesAttributeEditor';
import GenreAttributeEditor from './GenreAttributeEditor';
import React from 'react';
import {connect} from 'react-redux';
import {getAlbumById, getArtistById} from './redux/selectors';
import {RootState} from './redux/store';
import Track from './library/Track';
import {setMemberIds} from './utils';

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
    // TODO: turn into action
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
    setMemberIds(track.id, this.state.albumIds, track.albumIds, (id) => this.props.getAlbumById(id).trackIds);
    track.albumIds = this.state.albumIds;
    setMemberIds(track.id, this.state.artistIds, track.artistIds, (id) => this.props.getArtistById(id).trackIds);
    track.artistIds = this.state.artistIds;

    this.props.save();
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

export default connect(mapStateToProps, {save})(SingleSongEditer);
