import {setPlaylist, updateAlbum} from './redux/actions';
import {Album, Artist, TrackInfo} from './redux/actionTypes';
import AlbumEditor from './AlbumEditor';
import './AlbumInfo.css';
import ArtImg from './ArtImg';
import {remote} from 'electron';
import EmptyPlaylist from './playlist/EmptyPlaylist';
import defaultAlbum from './resources/missing_album.png';
import RandomAlbumPlaylist from './playlist/RandomAlbumPlaylist';
import * as React from 'react';
import Modal from 'react-modal';
import {connect} from 'react-redux';
import {getAlbumsByIds, getAllAlbumIds, getArtistsByIds, getWarningsFromAlbum} from './redux/selectors';
import reduxStore, {RootState} from './redux/store';

// see: http://reactcommunity.org/react-modal/accessibility/#app-element
Modal.setAppElement('#root');

interface StateProps {
  artists: Artist[];
  warnings: TrackInfo[];
}

interface OwnProps {
  album?: Album;
  style: React.CSSProperties;
  showStatus: boolean;
  goToAlbum(album: Album): void;
}

interface AlbumInfoState {
  editing: boolean;
}

interface DispatchProps {
  setPlaylist(playlist: EmptyPlaylist, play: boolean): void;
  updateAlbum(id: string, info: object): void;
}

type AlbumInfoProps = OwnProps & StateProps & DispatchProps;

class AlbumInfo extends React.Component<AlbumInfoProps, AlbumInfoState> {
  private timer?: number;
  private prevent: boolean;

  constructor(props: AlbumInfoProps) {
    super(props);

    this.timer = undefined;
    this.prevent = false;

    this.state = {
      editing: false,
    };
  }

  public render(): JSX.Element {
    // make width 150, fill remaining space w/ padding
    const width = this.props.style.width as number;
    const newStyle = {
      ...this.props.style,
      paddingLeft: (width - 150) / 2,
      paddingRight: (width - 150) / 2,
      width: 150,
      overflow: 'hidden',
    };
    if (!this.props.album) {
      return <div style={this.props.style} />;
    }
    if (this.props.showStatus) {
      newStyle.backgroundColor = 'rgba(63, 185, 80, 0.18)';
      if (this.props.warnings.find((warning) => Object.keys(warning).length > 0)) {
        newStyle.backgroundColor = 'rgba(210, 153, 34, 0.22)';
      }
      if (this.props.album.errors.length > 0 || !this.props.album.wikiPage) {
        newStyle.backgroundColor = 'rgba(248, 81, 73, 0.2)';
      }
    }

    const file = this.props.album.albumArtFile;
    const artists = this.props.artists.map((artist: Artist) => {
      return artist.name;
    }).join(', ');
    return (
      <div style={newStyle} >
        <Modal isOpen={this.state.editing} onRequestClose={() => this.closeEdit()}>
          <AlbumEditor exit={() => this.closeEdit()} album={this.props.album} />
        </Modal>
        <div style={{position: 'absolute', left: '50%'}}>
          <ArtImg
            alt="album art"
            className="grid-art"
            fallback={defaultAlbum}
            file={file}
            height="100"
            onClick={() => this.onClickAlbum()}
            onDoubleClick={() => this.onDoubleClickAlbum()}
            onContextMenu={() => this.onRightClickAlbum()}
            style={{marginTop: '10px', position: 'relative', left: '-50%'}}
            width="100"
          />
          <div className="info-label" >{this.props.album.name}</div>
          <div className="info-label" >{artists}</div>
        </div>
      </div>
    );
  }

  private onClickAlbum(): void {
    this.timer = window.setTimeout(() => {
      if (!this.prevent) {
        this.doClickAlbum();
      }
      this.prevent = false;
    }, 200);
  }

  private onDoubleClickAlbum(): void {
    clearTimeout(this.timer);
    this.prevent = true;
    this.doDoubleClickAlbum();
  }

  /**
   * Read on the click, not in `mapStateToProps`.
   *
   * This used to be `allAlbums: getAlbumsByIds(store, getAllAlbumIds(store))` — all 2,181
   * albums rebuilt for **every visible grid cell**, measured at 0.10ms each, so about 3ms per
   * redux action across ~30 cells, or 12ms/sec through playback. Worse, it was a fresh array
   * every time, so `connect` could never bail and all thirty cells re-rendered four times a
   * second. The shuffle only needs the list once, at the moment someone asks to play.
   */
  private doDoubleClickAlbum(): void {
    if (this.props.album) {
      const state = reduxStore.getState();
      const playlist = new RandomAlbumPlaylist(getAlbumsByIds(state, getAllAlbumIds(state)));
      playlist.addAlbum(this.props.album);
      this.props.setPlaylist(playlist, /* play= */ true);
    }
  }

  private doClickAlbum(): void {
    if (this.props.album) {
      this.props.goToAlbum(this.props.album);
    }
  }

  private onRightClickAlbum(): void {
    const menu = new remote.Menu();
    menu.append(new remote.MenuItem({label: 'Edit Info', click: this.edit.bind(this)}));
    menu.append(new remote.MenuItem({label: 'Favorite', click: this.favorite.bind(this)}));
    menu.popup({window: remote.getCurrentWindow()});
  }

  private edit(): void {
    this.setState({editing: true});
  }

  private closeEdit(): void {
    this.setState({editing: false});
  }

  private favorite(): void {
    if (this.props.album) {
      const favorites = this.props.album.favorites.slice();
      const year = new Date().getFullYear();
      if (favorites.indexOf(year) < 0) {
        favorites.push(year);
      }
      this.props.updateAlbum(this.props.album.id, {favorites: favorites});
    }
  }

}

function mapStateToProps(store: RootState, ownProps: OwnProps): StateProps {
  return {
    artists: ownProps.album ? getArtistsByIds(store, ownProps.album.artistIds) : [],
    warnings: getWarningsFromAlbum(store, ownProps.album),
  };
}

export default connect(mapStateToProps, {setPlaylist, updateAlbum})(AlbumInfo);
