import Album from './library/Album';
import Artist from './library/Artist';
import defaultAlbum from './resources/missing_album.png';
import * as React from 'react';
import {connect} from 'react-redux';
import {getArtistsByIds} from './redux/selectors';
import {RootState} from './redux/store';
import {getImgSrc} from './utils';

interface StateProps {
  artists: Artist[];
}

interface OwnProps {
  album: Album;
  style: React.CSSProperties;
  showStatus: boolean;
  playAlbum(album: Album): void;
  goToAlbum(album: Album): void;
}

type AlbumInfoProps = OwnProps & StateProps;

class AlbumInfo extends React.Component<AlbumInfoProps> {
  private timer?: number;
  private prevent: boolean;

  constructor(props: AlbumInfoProps) {
    super(props);

    this.timer = undefined;

    this.prevent = false;
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

    const file = this.props.album && this.props.album.albumArtFile;
    const src = file ? getImgSrc(file) : defaultAlbum;
    const artists = this.props.artists.map((artist: Artist) => {
      return artist.name;
    }).join(', ');
    return (
      <div style={newStyle} >
        <div style={{position: 'absolute', left: '50%'}}>
          <img
            alt="album art"
            height="100"
            onClick={() => this.onClickAlbum()}
            onDoubleClick={() => this.onDoubleClickAlbum()}
            src={src.toString()}
            style={{paddingTop: '10px', position: 'relative', left: '-50%'}}
            width="100"
          />
          <div
            style={{position: 'relative', left: '-50%', textAlign: 'center'}}
          >
            {this.props.album && this.props.album.name}
          </div>
          <div
            style={{position: 'relative', left: '-50%', textAlign: 'center'}}
          >
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
    this.props.playAlbum(this.props.album);
  }

  private doClickAlbum(): void {
    this.props.goToAlbum(this.props.album);
  }
}

function mapStateToProps(state: RootState, ownProps: OwnProps): StateProps {
  return {
    artists: ownProps.album ? getArtistsByIds(state, ownProps.album.artistIds) : [],
  };
}

export default connect(mapStateToProps)(AlbumInfo);
