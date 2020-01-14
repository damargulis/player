import Album from "./library/Album";
import Artist from "./library/Artist";
import Library from "./library/Library";
import defaultArtist from "./resources/missing_artist.png";
import React from "react";
import {getImgSrc} from "./utils";
import { connect } from "react-redux";
import {RootState} from "./redux/store";
import {getArtFilesByArtist} from "./redux/selectors";

function getAlbumArtFiles(library: Library , artist: Artist): string[] {
  const albums = library.getAlbumsByIds(artist.albumIds).map((album: Album) => album.albumArtFile);
  return [
    artist.artFile,
    ...albums,
  ].filter(Boolean) as string[];
}

interface ArtistInfoProps {
  artist: Artist;
  style: React.CSSProperties;
  goToArtist(artist: Artist): void;
  artFiles: string[];
}

interface ArtistInfoState {
  currentImg: number;
  timerId?: number;
}

class ArtistInfo extends React.Component<ArtistInfoProps, ArtistInfoState> {
  constructor(props: ArtistInfoProps) {
    super(props);

    this.state = {
      currentImg: 0,
      timerId: undefined,
    };
  }

  public componentDidMount(): void {
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
          currentImg: this.state.currentImg + 1,
        });
      }, time);
      if (!this.props.artist) {
        return;
      }
      this.setState({
        currentImg: this.state.currentImg + 1,
        timerId: id,
      });
    }, Math.random() * time);
    this.setState({
      timerId: timeoutId,
    });
  }

  public componentWillUnmount(): void {
    clearInterval(this.state.timerId);
  }

  public render(): JSX.Element {
    if (!this.props.artist) {
      return (
        <div style={this.props.style} />
      );
    }
    // recenter with new width filling full space
    const width = this.props.style.width as number;
    const newStyle = {
      ...this.props.style,
      paddingLeft: (width - 150) / 2,
      paddingRight: (width - 150) / 2,
      width: 150,
    };
    if (this.props.artist.errors.length > 0) {
      newStyle.backgroundColor = "red";
    }
    const artFiles = this.props.artFiles;
    const file = artFiles[this.state.currentImg % artFiles.length];
    const src = file ? getImgSrc(file) : defaultArtist;
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
            style={{position: "relative", left: "-50%", textAlign: "center"}}
          >
            {this.props.artist.name}
          </div>
        </div>
      </div>
    );
  }
}

interface OwnProps {
  artist: Artist,
}

function mapStateToProps(state: RootState, ownProps: OwnProps) {
  return {
    artFiles: getArtFilesByArtist(state, ownProps.artist),
  }
}

export default connect(mapStateToProps)(ArtistInfo);
