import {Album, Artist, Track} from './redux/actionTypes';
import {ipcRenderer} from 'electron';
import Links from './Links';
import defaultAlbum from './resources/missing_album.png';
import React from 'react';
import {connect} from 'react-redux';
import {getAlbumsByIds, getArtistsByIds, getCurrentTrack} from './redux/selectors';
import {RootState} from './redux/store';
import {getImgSrc} from './utils';

import './InfoPanel.css';

interface OwnProps {
  small?: boolean;
  goToAlbum(albumId: string): void;
  goToArtist(artistId: string): void;
  goToTrack(trackId: string): void;
}

interface StateProps {
  albums: Album[];
  artists: Artist[];
  track?: Track;
}

type InfoPanelProps = OwnProps & StateProps;

class InfoPanel extends React.Component<InfoPanelProps> {

  public render(): JSX.Element {
    const {track, albums} = this.props;
    const tracks = track ? [track] : [];
    const album = albums[0];
    const src = album && album.albumArtFile ? getImgSrc(album.albumArtFile) : defaultAlbum;
    // TODO: make rotate instead -- conditionally on playlist type??
    // meaning like if its playing a specific album, only show that album
    // (and artwork)
    // if on track shuffle, then rotate between all.
    const imgStyle = this.props.small ? {height: 50, width: 50, padding: 5}
      : {height: 70, width: 70, padding: 15};
    return (
      <div id="info-panel" style={{display: 'flex'}}>
        <img alt="album-art" onClick={() => this.onImageClick()} src={src} style={imgStyle} />
        <div style={{display: 'grid'}}>
          <div className="track-label" id="name">
            <Links items={tracks} goToItem={this.props.goToTrack} name="Track Name" />
          </div>
          <div className="track-label" id="author">
            <Links items={this.props.artists} goToItem={this.props.goToArtist} name="Artists" />
          </div>
          <div className="track-label" id="album">
            <Links items={this.props.albums} goToItem={this.props.goToAlbum} name="Albums" />
          </div>
          <div className="track-label" id="year">{track ? track.year : 'Year'}</div>
        </div>
      </div>
    );
  }

  private goToTrack(track?: Track): void {
    if (track) {
      this.props.goToTrack(track.id);
    }
  }

  private onImageClick(): void {
    if (this.props.small) {
      ipcRenderer.send('maximize');
    } else {
      ipcRenderer.send('minimize');
    }
  }

}

function mapStateToProps(state: RootState, ownProps: OwnProps): StateProps {
  const track = getCurrentTrack(state);
  const albums = track ? getAlbumsByIds(state, track.albumIds) : [];
  const artists = track ? getArtistsByIds(state, track.artistIds) : [];
  return {
    albums,
    artists,
    track,
  };
}

export default connect(mapStateToProps)(InfoPanel);
