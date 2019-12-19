import Album from './library/Album';
import Artist from './library/Artist';
import Library from './library/Library';
import React from 'react';
import {Resources} from './constants';
import {getImgSrc} from './utils';

function getAlbumArtFiles(library: Library , artist: Artist) {
  const albums = library.getAlbumsByIds(artist.albumIds);
  return albums.map((album: Album) => album.albumArtFile).filter(Boolean);
}

interface ArtistInfoProps {
  artist: Artist;
  library: Library;
  style: {
    width: number;
    backgroundColor: string;
  }
  goToArtist: (artist: Artist) => void;
}

interface ArtistInfoState {
  currentImg: number;
  timerId?: number;
}

export default class ArtistInfo extends React.Component<ArtistInfoProps,ArtistInfoState> {
  artFiles: string[];

  constructor(props: ArtistInfoProps) {
    super(props);

    const file = this.props.artist.artFile;
    this.artFiles = [
      file,
      ...getAlbumArtFiles(props.library, props.artist)
    ].filter(Boolean) as string[];
    this.state = {
      currentImg: 0,
      timerId: undefined,
    };
  }

  componentDidMount() {
    if (!this.props.artist) {
      return;
    }
    const time = 10000;
    const timeoutId = window.setTimeout(() => {
      const id = window.setInterval(() => {
        if (!this.props.artist) {
          return;
        }
        this.setState({
          currentImg:
            (this.state.currentImg + 1) % this.artFiles.length,
        });
      }, time);
      if (!this.props.artist) {
        return;
      }
      this.setState({
        timerId: id,
        currentImg:
          (this.state.currentImg + 1) % this.artFiles.length,
      });
    }, Math.random() * time);
    this.setState({
      timerId: timeoutId
    });
  }

  componentWillUnmount() {
    clearInterval(this.state.timerId);
  }

  render() {
    if (!this.props.artist) {
      return (
        <div style={this.props.style} />
      );
    }
    // recenter with new width filling full space
    const newStyle = {
      ...this.props.style,
      paddingLeft: (this.props.style.width - 150) / 2,
      paddingRight: (this.props.style.width - 150) / 2,
      width: 150
    };
    if (this.props.artist.errors.length > 0) {
      newStyle.backgroundColor = 'red';
    }
    let file = this.artFiles[this.state.currentImg];
    file = file || Resources.DEFAULT_ARTIST;
    const src = getImgSrc(file);
    return (
      <div
        onClick={() => this.props.goToArtist(this.props.artist)}
        style={newStyle}
      >
        <div style={{position: "absolute", left: "50%"}}>
          <img
            alt="artist art"
            height="100"
            src={src}
            style={{paddingTop: "10px", position: "relative", left: "-50%"}}
            width="100"
          />
          <div
            style={{position: "relative", left: "-50%", textAlign: 'center'}}
          >
            {this.props.artist.name}
          </div>
        </div>
      </div>
    );
  }
}
