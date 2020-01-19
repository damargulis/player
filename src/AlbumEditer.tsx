import {save} from './redux/actions';
import Album from './library/Album';
import Artist from './library/Artist';
import ArtistAttributeEditor from './ArtistAttributeEditor';
import FavoritesAttributeEditor from './FavoritesAttributeEditor';
import GenreAttributeEditor from './GenreAttributeEditor';
import React from 'react';
import {connect} from 'react-redux';
import {getArtistById} from './redux/selectors';
import {RootState} from './redux/store';

interface OwnProps {
  album: Album;
  exit(): void;
}

interface StateProps {
  getArtistById(id: number): Artist;
}

interface DispatchProps {
  save(): void;
}

type AlbumEditerProps = OwnProps & StateProps & DispatchProps;

interface AlbumEditerState {
  artistIds: number[];
  genreIds: number[];
  yearsFavorited: number[];
}

class AlbumEditer extends React.Component<AlbumEditerProps, AlbumEditerState> {
  private name = React.createRef<HTMLInputElement>();
  private year = React.createRef<HTMLInputElement>();
  private playCount = React.createRef<HTMLInputElement>();
  private wikiPage = React.createRef<HTMLInputElement>();

  constructor(props: AlbumEditerProps) {
    super(props);
    const album = this.props.album;

    this.state = {
      artistIds: [...album.artistIds],
      genreIds: [...album.genreIds],
      yearsFavorited: [...album.favorites],
    };

  }

  public save(): void {
    // TODO: turn into action
    const album = this.props.album;
    if (this.name.current) {
      album.name = this.name.current.value;
    }
    if (this.year.current) {
      album.year = parseInt(this.year.current.value, 10);
    }
    if (this.playCount.current) {
      album.playCount = parseInt(this.playCount.current.value, 10);
    }
    album.favorites = this.state.yearsFavorited;
    album.genreIds = this.state.genreIds;
    this.state.artistIds.forEach((artistId) => {
      if (!album.artistIds.includes(artistId)) {
        const artist = this.props.getArtistById(artistId);
        artist.albumIds.push(album.id);
      }
    });
    album.artistIds = this.state.artistIds;
    if (this.wikiPage.current) {
      album.wikiPage = this.wikiPage.current.value;
    }

    this.props.save();
    this.props.exit();
  }

  render(): JSX.Element {
    const album = this.props.album;
    return (
      <div>
        <h3 className="title">Edit Album</h3>
        <div className="edit-container">
          <label className="label">Name: </label>
          <input className="input" defaultValue={album.name} placeholder="Name" ref={this.name} />
        </div>
        <ArtistAttributeEditor artistIds={this.state.artistIds} />
        <div className="edit-container">
          <label className="label">Year: </label>
          <input className="input" defaultValue={album.year} placeholder="Year" ref={this.year} type="number" />
        </div>
        <GenreAttributeEditor genreIds={this.state.genreIds} />
        <FavoritesAttributeEditor yearsFavorited={this.state.yearsFavorited} />
        <div className="edit-container">
          <label className="label">Play Count:</label>
          <input className="input" defaultValue={album.playCount} ref={this.playCount} type="number" />
        </div>
        <div className="edit-container">
          <label className="label">Wiki page:</label>
          <input className="input" defaultValue={album.wikiPage} ref={this.wikiPage} />
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
    getArtistById: (id: number) => getArtistById(state, id),
  };
}

export default connect(mapStateToProps, {save})(AlbumEditer);
