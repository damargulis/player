import {updateArtist} from './redux/actions';
import {Artist} from './redux/actionTypes';
import AlbumAttributeEditor from './AlbumAttributeEditor';
import AttributeEditor from './AttributeEditor';
import GenreAttributeEditor from './GenreAttributeEditor';
import React from 'react';
import {connect} from 'react-redux';
import {RootState} from './redux/store';
import TrackAttributeEditor from './TrackAttributeEditor';

interface OwnProps {
  artist: Artist;
  exit(): void;
}

interface StateProps {
}

interface DispatchProps {
  updateArtist(id: string, info: object): void;
}

type ArtistEditorProps = OwnProps & StateProps & DispatchProps;

interface ArtistEditorState {
  albumIds: string[];
  genreIds: string[];
  trackIds: string[];
}

class ArtistEditor extends React.Component<ArtistEditorProps, ArtistEditorState> {
  private name = React.createRef<AttributeEditor>();
  private wikiPage = React.createRef<AttributeEditor>();

  constructor(props: ArtistEditorProps) {
    super(props);

    const artist = this.props.artist;
    this.state = {
      albumIds: [...artist.albumIds],
      genreIds: [...artist.genreIds],
      trackIds: [...artist.trackIds],
    };
  }

  public render(): JSX.Element {
    const artist = this.props.artist;
    return (
      <div>
        <h3 className="title">Edit Artist</h3>
        <AttributeEditor name="Name" val={artist.name} ref={this.name} />
        <GenreAttributeEditor genreIds={this.state.genreIds} />
        <AttributeEditor name="Wiki Page" val={artist.wikiPage} ref={this.wikiPage} />
        <AlbumAttributeEditor albumIds={this.state.albumIds} />
        <TrackAttributeEditor trackIds={this.state.trackIds} setIds={(trackIds) => this.setState({trackIds})} />
        <div className="bottom-bar">
          <button onClick={this.save.bind(this)}>Save</button>
          <button onClick={this.props.exit}>Cancel</button>
        </div>
      </div>
    );
  }

  private save(): void {
    this.props.updateArtist(this.props.artist.id, {
      name: this.name.current && this.name.current.value,
      genreIds: this.state.genreIds,
      albumIds: this.state.albumIds,
      trackIds: this.state.trackIds,
      wikiPage: this.wikiPage.current && this.wikiPage.current.value,
    });
    this.props.exit();
  }

}

function mapStateToProps(state: RootState): StateProps {
  return {};
}

export default connect(mapStateToProps, {updateArtist})(ArtistEditor);
