import {updateArtist} from './redux/actions';
import {Album, Artist, ArtistInfo, Track} from './redux/actionTypes';
import AlbumPicker from './AlbumPicker';
import ArtistEditor from './ArtistEditor';
import './ArtistPage.css';
import runArtistModifier from './extensions/wiki/artists';
import defaultArtist from './resources/missing_artist.png';
import NavigationBar from './NavigationBar';
import React from 'react';
import Modal from 'react-modal';
import {connect} from 'react-redux';
import {getAlbumsByIds, getArtistById, getTracksByIds} from './redux/selectors';
import {RootState} from './redux/store';
import TrackPicker from './TrackPicker';
import {getImgSrc} from './utils';
import WikiLabel from './WikiLabel';

interface StateProps {
  albums: Album[];
  tracks: Track[];
  artist: Artist;
  runArtistModifier(artist: Artist): Promise<ArtistInfo>;
}

interface OwnProps {
  artistId: number;
  canGoForward: boolean;
  goBack(): void;
  goForward(): void;
  goToAlbum(albumId: number): void;
}

interface DispatchProps {
  updateArtist(id: number, info: ArtistInfo): void;
}

type ArtistPageProps = OwnProps & StateProps & DispatchProps;

interface ArtistPageState {
  editing: boolean;
}

class ArtistPage extends React.Component<ArtistPageProps, ArtistPageState> {
  constructor(props: ArtistPageProps) {
    super(props);

    this.state = {
      editing: false,
    };
  }

  public render(): JSX.Element {
    const src = this.props.artist.artFile ? getImgSrc(this.props.artist.artFile) : defaultArtist;
    return (
      <div className="main">
        <Modal isOpen={this.state.editing} onRequestClose={this.closeEdit.bind(this)}>
          <ArtistEditor exit={this.closeEdit.bind(this)} artist={this.props.artist} />
        </Modal>
        <div className="artistPageHolder" >
          <div className="artistPageHeader" >
            <NavigationBar
              canGoForward={this.props.canGoForward}
              goBack={this.props.goBack}
              goForward={this.props.goForward}
            />
            <div className="info">
              <img alt="artist art" height="100" src={src} width="100" />
              <div>{this.props.artist.name}</div>
              <WikiLabel wikiPage={this.props.artist.wikiPage} />
              <button onClick={this.runWiki.bind(this)}>Run Wiki Extension</button>
            </div>
            <button onClick={this.editArtist.bind(this)} className="editArtist" >Edit Artist</button>
            {this.getErrors()}
          </div>
          <div className="artistPageBody" >
            <div className="artistPageContainer" >
              <AlbumPicker albums={this.props.albums} goToAlbum={this.props.goToAlbum} />
            </div>
            <div className="artistPageContainer" >
              <TrackPicker tracks={this.props.tracks} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  private editArtist(): void {
    this.setState({editing: true});
  }

  private closeEdit(): void {
    this.setState({editing: false});
  }

  private runWiki(): void {
    this.props.runArtistModifier(this.props.artist).then((info: ArtistInfo) => {
      this.props.updateArtist(this.props.artist.id, info);
    });
  }

  private getErrors(): JSX.Element | undefined {
    if (!this.props.artist.errors.length) {
      return;
    }
    return (
      <div className="errorsContainer" >
        <div> Errors: </div>
        {
          this.props.artist.errors.map((error) => {
            return (
              <div key={error}>{error}</div>
            );
          })
        }
      </div>

    );
  }
}

function mapStateToProps(store: RootState, ownProps: OwnProps): StateProps {
  const artist = getArtistById(store, ownProps.artistId);
  return {
    albums: getAlbumsByIds(store, artist.albumIds),
    runArtistModifier: (a: Artist) => runArtistModifier(store, a),
    tracks: getTracksByIds(store, artist.trackIds),
    artist: artist,
  };
}

export default connect(mapStateToProps, {updateArtist})(ArtistPage);
