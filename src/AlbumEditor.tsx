import {updateAlbum} from './redux/actions';
import {Album, AlbumInfo, Artist, Track} from './redux/actionTypes';
import {musicBrainzUrl, parseMbid} from './extensions/musicbrainz/api';
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
  updateAlbum(id: string, info: AlbumInfo): void;
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
  private mbid = React.createRef<AttributeEditor>();

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
        <AttributeEditor name="MusicBrainz" val={musicBrainzUrl('release-group', album.mbid)} ref={this.mbid} />
        <TrackAttributeEditor trackIds={this.state.trackIds} setIds={(trackIds) => this.setState({trackIds})}/>
        <div className="bottom-bar">
          <button onClick={() => this.save()}>Save</button>
          <button onClick={this.props.exit}>Cancel</button>
        </div>
      </div>
    );
  }

  /**
   * Falls back to what the album already holds when a ref is missing.
   *
   * It used to be `this.name.current && this.name.current.value`, which yields **null** for an
   * absent ref — and the reducer spreads the update over the album, so that would have written
   * `null` into a field typed `string | undefined`. The refs are attached whenever this renders,
   * so it never fired; keeping the current value is the right answer if it ever does, and
   * `undefined` would not be, because a key present and undefined clobbers just as well.
   */
  private save(): void {
    const album = this.props.album;
    this.props.updateAlbum(album.id, {
      artistIds: this.state.artistIds,
      errors: album.errors,
      favorites: this.state.yearsFavorited,
      genreIds: this.state.genreIds,
      mbid: this.mbid.current ? parseMbid(this.mbid.current.value) : album.mbid,
      name: this.name.current ? this.name.current.value : album.name,
      playCount: this.playCount.current ? parseInt(this.playCount.current.value, 10) : album.playCount,
      skipCount: album.skipCount,
      trackIds: this.state.trackIds,
      wikiPage: this.wikiPage.current ? this.wikiPage.current.value : album.wikiPage,
      year: this.year.current ? parseInt(this.year.current.value, 10) : album.year,
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
