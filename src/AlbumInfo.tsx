import {save} from './redux/actions';
import EmptyPlaylist from './playlist/EmptyPlaylist';
import {getAlbumsByIds, getAllAlbumIds, getArtistsByIds} from './redux/selectors';
import {setPlaylist} from './redux/actions';
import RandomAlbumPlaylist from './playlist/RandomAlbumPlaylist';
import AlbumEditer from './AlbumEditer'; import Modal from 'react-modal';
import Album from './library/Album';
import Artist from './library/Artist';
import {remote} from 'electron';
import defaultAlbum from './resources/missing_album.png';
import * as React from 'react';
import {connect} from 'react-redux';
import {RootState} from './redux/store';
import {getImgSrc} from './utils';

// see: http://reactcommunity.org/react-modal/accessibility/#app-element
Modal.setAppElement('#root');

interface StateProps {
  artists: Artist[];
  allAlbums: Album[];
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
  save(): void;
  setPlaylist(playlist: EmptyPlaylist, play: boolean): void;
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
    };
    if (!this.props.album) {
      return (
        <div style={this.props.style} />
      );
    }
    if (this.props.showStatus) {
      newStyle.backgroundColor = 'green';
      if (Object.keys(this.props.album.warnings).length > 0) {
        newStyle.backgroundColor = 'yellow';
      }
      if (this.props.album.errors.length > 0 || !this.props.album.wikiPage) {
        newStyle.backgroundColor = 'red';
      }
    }

    const file = this.props.album.albumArtFile;
    const src = file ? getImgSrc(file) : defaultAlbum;
    const artists = this.props.artists.map((artist: Artist) => {
      return artist.name;
    }).join(', ');
    return (
      <div style={newStyle} >
        <Modal isOpen={this.state.editing} onRequestClose={this.closeEdit.bind(this)}>
          <AlbumEditer exit={this.closeEdit.bind(this)} album={this.props.album} />
        </Modal>
        <div style={{position: 'absolute', left: '50%'}}>
          <img
            alt="album art"
            height="100"
            onClick={() => this.onClickAlbum()}
            onDoubleClick={() => this.onDoubleClickAlbum()}
            onContextMenu={() => this.onRightClickAlbum()}
            src={src.toString()}
            style={{paddingTop: '10px', position: 'relative', left: '-50%'}}
            width="100"
          />
          <div style={{position: 'relative', left: '-50%', textAlign: 'center'}} >
            {this.props.album.name}
          </div>
          <div style={{position: 'relative', left: '-50%', textAlign: 'center'}} >
            {artists}
          </div>
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

  private doDoubleClickAlbum(): void {
    if (this.props.album) {
      const playlist = new RandomAlbumPlaylist(this.props.allAlbums);
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
      const year = new Date().getFullYear();
      if (this.props.album.favorites.indexOf(year) < 0) {
        this.props.album.favorites.push(year);
      }
      this.props.save();
      this.forceUpdate();
    }
  }

}

function mapStateToProps(store: RootState, ownProps: OwnProps): StateProps {
  return {
    artists: ownProps.album ? getArtistsByIds(store, ownProps.album.artistIds) : [],
    allAlbums: getAlbumsByIds(store, getAllAlbumIds(store)),
  };
}

export default connect(mapStateToProps, {save, setPlaylist})(AlbumInfo);
