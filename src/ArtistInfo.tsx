import {Artist} from './redux/actionTypes';
import defaultArtist from './resources/missing_artist.png';
import React from 'react';
import {connect} from 'react-redux';
import {getArtFilesByArtist} from './redux/selectors';
import {RootState} from './redux/store';
import {getImgSrc} from './utils';

interface StateProps {
  artFiles: string[];
}

interface OwnProps {
  artist?: Artist;
  style: React.CSSProperties;
  goToArtist(artistId: string): void;
}

type ArtistInfoProps = OwnProps & StateProps;

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
        this.setState({currentImg: this.state.currentImg + 1});
      }, time);
      if (!this.props.artist) {
        return;
      }
      this.setState({
        currentImg: this.state.currentImg + 1,
        timerId: id,
      });
    }, Math.random() * time);
    this.setState({timerId: timeoutId});
  }

  public componentWillUnmount(): void {
    clearInterval(this.state.timerId);
  }

  public render(): JSX.Element {
    const artist = this.props.artist;
    if (!artist) {
      return <div style={this.props.style} />;
    }
    // recenter with new width filling full space
    const width = this.props.style.width as number;
    const newStyle = {
      ...this.props.style,
      paddingLeft: (width - 150) / 2,
      paddingRight: (width - 150) / 2,
      width: 150,
    };
    if (artist.errors.length > 0) {
      newStyle.backgroundColor = 'red';
    }
    const artFiles = this.props.artFiles;
    const file = artFiles[this.state.currentImg % artFiles.length];
    const src = file ? getImgSrc(file) : defaultArtist;
    return (
      <div onClick={() => this.props.goToArtist(artist.id)} style={newStyle} >
        <div style={{position: 'absolute', left: '50%'}}>
          <img
            alt="artist art"
            height="100"
            src={src}
            style={{paddingTop: '10px', position: 'relative', left: '-50%'}}
            width="100"
          />
          <div className="info-label" >{artist.name}</div>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state: RootState, ownProps: OwnProps): StateProps {
  return {
    artFiles: ownProps.artist ? getArtFilesByArtist(state, ownProps.artist) : [],
  };
}

export default connect(mapStateToProps)(ArtistInfo);
