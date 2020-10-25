import {updateAlbum} from './redux/actions';
import {Album, Artist, Track} from './redux/actionTypes';
import ArtistAttributeEditor from './ArtistAttributeEditor';
import AttributeEditor from './AttributeEditor';
import FavoritesAttributeEditor from './FavoritesAttributeEditor';
import GenreAttributeEditor from './GenreAttributeEditor';
import React from 'react';
import {connect} from 'react-redux';
import {getArtistById, getTrackById} from './redux/selectors';
import {RootState} from './redux/store';
import TrackAttributeEditor from './TrackAttributeEditor';

interface OwnProps {
  album: Album;
  exit(): void;
}

interface StateProps {
  getArtistById(id: string): Artist;
  getTrackById(id: string): Track;
}

interface DispatchProps {
  updateAlbum(id: string, info: object): void;
}

type AlbumEditorProps = OwnProps & StateProps & DispatchProps;

interface AlbumEditorState {
  artistIds: string[];
  genreIds: string[];
  yearsFavorited: number[];
  trackIds: string[];
}

class AlbumEditor extends React.Component<AlbumEditorProps, AlbumEditorState> {
  private name = React.createRef<AttributeEditor>();
  private year = React.createRef<AttributeEditor>();
  private playCount = React.createRef<AttributeEditor>();
  private wikiPage = React.createRef<AttributeEditor>();

  constructor(props: AlbumEditorProps) {
    super(props);
    const album = this.props.album;

    this.state = {
      artistIds: [...album.artistIds],
      genreIds: [...album.genreIds],
      yearsFavorited: [...album.favorites],
      trackIds: [...album.trackIds],
    };

  }

  render(): JSX.Element {
    const album = this.props.album;
    return (
      <div>
        <h3 className="title">Edit Album</h3>
        <AttributeEditor name="Name" val={album.name} ref={this.name} />
        <ArtistAttributeEditor artistIds={this.state.artistIds} />
        <AttributeEditor name="Year" val={album.year} ref={this.year} />
        <GenreAttributeEditor genreIds={this.state.genreIds} />
        <FavoritesAttributeEditor yearsFavorited={this.state.yearsFavorited} />
        <AttributeEditor name="Play Count" val={album.playCount} ref={this.playCount} />
        <AttributeEditor name="Wiki Page" val={album.wikiPage} ref={this.wikiPage} />
        <TrackAttributeEditor trackIds={this.state.trackIds} setIds={(trackIds) => this.setState({trackIds})}/>
        <div className="bottom-bar">
          <button onClick={this.save.bind(this)}>Save</button>
          <button onClick={this.props.exit}>Cancel</button>
        </div>
      </div>
    );
  }

  private save(): void {
    this.props.updateAlbum(this.props.album.id, {
      name: this.name.current && this.name.current.value,
      year: this.year.current && parseInt(this.year.current.value, 10),
      playCount: this.playCount.current && parseInt(this.playCount.current.value, 10),
      favorites: this.state.yearsFavorited,
      genreIds: this.state.genreIds,
      artistIds: this.state.artistIds,
      wikiPage: this.wikiPage.current && this.wikiPage.current.value,
      trackIds: this.state.trackIds,
      errors: this.props.album.errors,
      warnings: this.props.album.warnings,
      id: this.props.album.id,
      skipCount: this.props.album.skipCount,
    });
    this.props.exit();
  }

}

function mapStateToProps(state: RootState): StateProps {
  return {
    getArtistById: (id: string) => getArtistById(state, id),
    getTrackById: (id: string) => getTrackById(state, id),
  };
}

export default connect(mapStateToProps, {updateAlbum})(AlbumEditor);
