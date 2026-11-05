import {imageSize} from './extensions/imageSize';
import React from 'react';
import {getImgSrc} from './utils';

import './ArtZoom.css';

interface OwnProps {
  file: string;
  title: string;
  subtitle?: string;
  close(): void;
}

/**
 * The full-size album or artist image, over a dimmed backdrop.
 *
 * Worth having now that the Cover Art extension fetches at 1200px rather than 500 — the pages
 * show a 100px thumbnail, so before this there was no way to see the art you had.
 *
 * The real pixel size is read off the file and shown, because it is the one thing a viewer
 * cannot tell by looking: a 500px cover scaled up to fill the window looks much like a 1200px
 * one until you compare them, and it tells you whether a Cover Art run is still worth doing.
 */
interface State {
  /** Read once on mount: the renderer is the thread playing audio, so not in render(). */
  size?: {width: number; height: number};
}

export default class ArtZoom extends React.Component<OwnProps, State> {
  constructor(props: OwnProps) {
    super(props);
    this.state = {};
  }

  public componentDidMount(): void {
    document.addEventListener('keydown', this.onKeyDown);
    this.setState({size: imageSize(this.props.file)});
  }

  public componentWillUnmount(): void {
    document.removeEventListener('keydown', this.onKeyDown);
  }

  public render(): JSX.Element {
    const {size} = this.state;
    return (
      <div className="artZoomBackdrop" onClick={() => this.props.close()}>
        {/* the image is deliberately not click-stopped: clicking the art again closes it,
            which is what a viewer expects of a lightbox */}
        <img alt={this.props.title} className="artZoomImage" src={getImgSrc(this.props.file)} />
        <div className="artZoomCaption">
          <span className="artZoomTitle">{this.props.title}</span>
          {this.props.subtitle && <span className="artZoomSubtitle">{this.props.subtitle}</span>}
          {size && <span className="artZoomSize">{size.width} × {size.height}</span>}
        </div>
      </div>
    );
  }

  private onKeyDown = (evt: KeyboardEvent): void => {
    if (evt.key === 'Escape') {
      this.props.close();
    }
  };
}
