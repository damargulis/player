import {updateArtist} from './redux/actions';
import {AlbumParams, Artist, ArtistInfo, Track} from './redux/actionTypes';
import AlbumPicker from './AlbumPicker';
import './ArtistPage.css';
import runArtistModifier from './extensions/wiki/artists';
import EditableAttribute from './EditableAttribute';
import defaultArtist from './resources/missing_artist.png';
import NavigationBar from './NavigationBar';
import React from 'react';
import {connect} from 'react-redux';
import {getAlbumsByIds, getTracksByIds} from './redux/selectors';
import SongPicker from './SongPicker';
import {RootState} from './redux/store';
import {getImgSrc} from './utils';
import WikiLabel from './WikiLabel';

interface StateProps {
  albums: AlbumParams[];
  tracks: Track[];
  runArtistModifier(artist: Artist): Promise<ArtistInfo>;
}

interface OwnProps {
  artist: Artist;
  canGoForward: boolean;
  goBack(): void;
  goForward(): void;
  goToAlbum(album: AlbumParams): void;
}

interface DispatchProps {
  updateArtist(id: number, info: ArtistInfo): void;
}

type ArtistPageProps = OwnProps & StateProps & DispatchProps;

class ArtistPage extends React.Component<ArtistPageProps> {

  public render(): JSX.Element {
    const src = this.props.artist.artFile ? getImgSrc(this.props.artist.artFile) : defaultArtist;
    return (
      <div className="main">
        <div className="artistPageHolder" >
          <div className="artistPageHeader" >
            <NavigationBar
              canGoForward={this.props.canGoForward}
              goBack={this.props.goBack}
              goForward={this.props.goForward}
            />
            <div className="info">
              <img alt="artist art" height="100" src={src} width="100" />
              <EditableAttribute
                attr={this.props.artist && this.props.artist.name}
                onSave={(value: string) => {
                  this.props.artist.name = value;
                }}
              />
              <WikiLabel wikiPage={this.props.artist.wikiPage} />
              <button onClick={this.runWiki.bind(this)}>Run Wiki Extension</button>
            </div>
            {this.getErrors()}
          </div>
          <div className="artistPageBody" >
            <div className="artistPageContainer" >
              <AlbumPicker albums={this.props.albums} goToAlbum={this.props.goToAlbum} />
            </div>
            <div className="artistPageContainer" >
              <SongPicker songs={this.props.tracks} />
            </div>
          </div>
        </div>
      </div>
    );
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
  return {
    albums: getAlbumsByIds(store, ownProps.artist.albumIds),
    runArtistModifier: (artist: Artist) => runArtistModifier(store, artist),
    tracks: getTracksByIds(store, ownProps.artist.trackIds),
  };
}

export default connect(mapStateToProps, {updateArtist})(ArtistPage);
