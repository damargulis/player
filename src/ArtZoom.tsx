import {imageSize} from './extensions/imageSize';
import React from 'react';
import {getImgSrc} from './utils';

import './ArtZoom.css';

interface OwnProps {
  file: string;
  title: string;
  subtitle?: string;
  /** `Album.coverArt`: the largest CAA served, and the size that was asked for. */
  coverArt?: {maxPx: number; target: number};
  /**
   * When given, a Run button beside the dimensions.
   *
   * It belongs here rather than on the page: the size is what decides whether fetching a better
   * cover is worth anything, and the size is only shown here now. A 220px cover is invisible
   * behind a 100px thumbnail, so the button was an invitation with nothing to judge it by.
   */
  onRun?(): Promise<void>;
  close(): void;
}

interface State {
  /** Pixel dimensions of the file, re-read after a run, which overwrites it in place. */
  size?: {width: number; height: number};
  running?: boolean;
  message?: string;
  /** 1 means fitted to the window; above that is zoomed in. */
  scale: number;
  /** Pan offset from centre, in screen pixels. */
  tx: number;
  ty: number;
  /** The fitted on-screen size at scale 1, measured once the image has laid out. */
  fit?: {width: number; height: number};
}

/** Below this, the window is the limit rather than the file. */
const MIN_SCALE = 1;
/**
 * Enough to inspect a 1200px cover's lettering without the controls becoming a microscope.
 * At the top end a 1200px file is showing roughly a dozen source pixels per screen inch.
 */
const MAX_SCALE = 8;
const STEP = 1.25;
/** A pointer that moved less than this was a click, not a drag. */
const DRAG_SLOP_PX = 4;

/**
 * The full-size album or artist image, zoomable.
 *
 * Worth having now that the Cover Art extension fetches at 1200px rather than 500 — the pages
 * show a 100px thumbnail, so before this there was no way to see the art you had.
 *
 * It opens fitted to the window and zooms **past** that, because fitting is not the same as
 * seeing: a 1200px cover on this display fits at roughly 80% of its own pixels, so even the
 * detail the file already holds was unreachable. The caption gives the file's real dimensions
 * and the percentage of them currently on screen, so passing 1:1 — the point beyond which it
 * is upscaling rather than revealing — is visible rather than guessed at.
 *
 * Zooming follows the cursor, so the thing being looked at stays under it.
 */
export default class ArtZoom extends React.Component<OwnProps, State> {
  private container: HTMLDivElement | null = null;
  private dragFrom?: {x: number; y: number; tx: number; ty: number};
  private dragged = false;

  constructor(props: OwnProps) {
    super(props);
    this.state = {scale: 1, tx: 0, ty: 0};
  }

  public componentDidMount(): void {
    document.addEventListener('keydown', this.onKeyDown);
    this.setState({size: imageSize(this.props.file)});
  }

  public componentWillUnmount(): void {
    document.removeEventListener('keydown', this.onKeyDown);
  }

  public render(): JSX.Element {
    const {scale} = this.state;
    return (
      <div
        className={`artZoomBackdrop${scale > 1 ? ' zoomed' : ''}`}
        onMouseDown={(evt) => this.onMouseDown(evt)}
        onMouseLeave={() => this.endDrag()}
        onMouseMove={(evt) => this.onMouseMove(evt)}
        onMouseUp={() => this.onMouseUp()}
        onWheel={(evt) => this.onWheel(evt)}
        ref={(el) => this.container = el}
      >
        <img
          alt={this.props.title}
          className="artZoomImage"
          draggable={false}
          onLoad={(evt) => this.measureFit(evt.currentTarget)}
          src={getImgSrc(this.props.file)}
          style={{transform: `translate(${this.state.tx}px, ${this.state.ty}px) scale(${scale})`}}
        />
        <div className="artZoomCaption" onMouseDown={(evt) => evt.stopPropagation()}>
          <span className="artZoomTitle">{this.props.title}</span>
          {this.props.subtitle && <span className="artZoomSubtitle">{this.props.subtitle}</span>}
          <span className="artZoomSizeRow">
            <span className="artZoomSize">{this.describeSize()}</span>
            {this.props.onRun && (
              <button
                className="artZoomRun"
                disabled={this.state.running}
                onClick={() => this.run()}
                title="Fetch the largest cover the Cover Art Archive has for this album"
              >
                {this.state.running ? '…' : 'Run'}
              </button>
            )}
            {this.state.message && <span className="artZoomNote">{this.state.message}</span>}
            {!this.state.message && this.atArchiveBest() && (
              <span className="artZoomNote">largest the Archive has</span>
            )}
          </span>
          <span className="artZoomControls">
            <button disabled={scale <= MIN_SCALE} onClick={() => this.zoomBy(1 / STEP)}>−</button>
            <button disabled={scale >= MAX_SCALE} onClick={() => this.zoomBy(STEP)}>+</button>
            <button disabled={scale === 1} onClick={() => this.reset()}>Fit</button>
          </span>
        </div>
      </div>
    );
  }

  /**
   * "1200 × 1200 · 94% of actual size".
   *
   * The percentage is of the file's own pixels, not of the window, because that is the number
   * that says whether more detail is still available or the view has started upscaling.
   */
  private describeSize(): string {
    const {size, fit, scale} = this.state;
    if (!size) {
      return '';
    }
    const dims = `${size.width} × ${size.height}`;
    if (!fit || !fit.width) {
      return dims;
    }
    const percent = Math.round(((fit.width * scale) / size.width) * 100);
    return `${dims} · ${percent}% of actual size`;
  }

  /**
   * True when the Archive is the limit, which is only knowable **below** the target.
   *
   * `maxPx` is what CAA served for `front-1200`, and CAA does not upscale: under 1200 means the
   * community's upload really is that small, so a re-run cannot help and saying so is worth a
   * line. At 1200 it means only "the original is at least 1200" — the Archive may well hold a
   * 2848px `front` that the extension deliberately does not ask for. Shown there, the note was
   * both uninformative and untrue, and on this library that was 1,192 albums against the 798
   * it actually tells you something about.
   */
  private atArchiveBest(): boolean {
    const {size} = this.state;
    const marker = this.props.coverArt;
    if (!size || !marker || marker.maxPx >= marker.target) {
      return false;
    }
    return Math.max(size.width, size.height) >= marker.maxPx;
  }

  private run(): void {
    const onRun = this.props.onRun;
    if (!onRun) {
      return;
    }
    this.setState({message: undefined, running: true});
    onRun().then(() => {
      // the file is overwritten in place, so re-measure rather than trust the old dimensions;
      // getImgSrc's mtime cache-buster is what makes the <img> pick up the new bytes
      this.setState({running: false, size: imageSize(this.props.file)});
    }, (err: Error) => {
      this.setState({message: err.message, running: false});
    });
  }

  /** The fitted size at scale 1, which every zoom is relative to. */
  private measureFit(img: HTMLImageElement): void {
    if (this.state.scale === 1) {
      this.setState({fit: {height: img.clientHeight, width: img.clientWidth}});
    }
  }

  private onWheel(evt: React.WheelEvent): void {
    evt.preventDefault();
    // trackpads report fractional deltas; the sign is all that matters here
    this.zoomBy(evt.deltaY < 0 ? STEP : 1 / STEP, evt.clientX, evt.clientY);
  }

  /**
   * Scales about a point, keeping whatever is under it in place.
   *
   * With no point given it zooms about the centre, which is what the buttons and keys want.
   */
  private zoomBy(factor: number, atX?: number, atY?: number): void {
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.state.scale * factor));
    if (next === this.state.scale) {
      return;
    }
    if (next === 1) {
      this.setState({scale: 1, tx: 0, ty: 0});
      return;
    }
    const box = this.container && this.container.getBoundingClientRect();
    const centreX = box ? box.left + box.width / 2 : 0;
    const centreY = box ? box.top + box.height / 2 : 0;
    const mouseX = atX === undefined ? centreX : atX;
    const mouseY = atY === undefined ? centreY : atY;
    // the cursor's offset from the container centre, in screen pixels
    const fromCentreX = mouseX - centreX;
    const fromCentreY = mouseY - centreY;
    const ratio = next / this.state.scale;
    this.setState({
      scale: next,
      ...this.clampPan(
        fromCentreX - (fromCentreX - this.state.tx) * ratio,
        fromCentreY - (fromCentreY - this.state.ty) * ratio,
        next,
      ),
    });
  }

  /**
   * Keeps the image overlapping the window.
   *
   * Without it the art can be flung off screen and the only way back is closing the panel.
   */
  private clampPan(tx: number, ty: number, scale: number): {tx: number; ty: number} {
    const {fit} = this.state;
    const box = this.container && this.container.getBoundingClientRect();
    if (!fit || !box) {
      return {tx, ty};
    }
    const limitX = Math.max(0, (fit.width * scale - box.width) / 2);
    const limitY = Math.max(0, (fit.height * scale - box.height) / 2);
    return {
      tx: Math.min(limitX, Math.max(-limitX, tx)),
      ty: Math.min(limitY, Math.max(-limitY, ty)),
    };
  }

  private onMouseDown(evt: React.MouseEvent): void {
    this.dragged = false;
    this.dragFrom = {tx: this.state.tx, ty: this.state.ty, x: evt.clientX, y: evt.clientY};
  }

  private onMouseMove(evt: React.MouseEvent): void {
    const from = this.dragFrom;
    if (!from) {
      return;
    }
    const dx = evt.clientX - from.x;
    const dy = evt.clientY - from.y;
    if (!this.dragged && Math.abs(dx) + Math.abs(dy) < DRAG_SLOP_PX) {
      return;
    }
    this.dragged = true;
    if (this.state.scale > 1) {
      this.setState(this.clampPan(from.tx + dx, from.ty + dy, this.state.scale));
    }
  }

  /**
   * A click on the backdrop closes; a drag does not, or panning would shut the panel every
   * time.
   *
   * It has to check that the press *started* on the backdrop, not just that no drag happened.
   * The caption stops `mousedown` from bubbling so pressing a button cannot begin a pan — but
   * `mouseup` still bubbles here, so a press on the + button released on the + button looked
   * exactly like a click on the backdrop and shut the window. Requiring the press to have
   * opened a drag covers any control added to the caption later, rather than needing each one
   * to stop the event itself.
   */
  private onMouseUp(): void {
    const startedOnBackdrop = !!this.dragFrom;
    const wasDrag = this.dragged;
    this.endDrag();
    if (startedOnBackdrop && !wasDrag) {
      this.props.close();
    }
  }

  private endDrag(): void {
    this.dragFrom = undefined;
  }

  private reset(): void {
    this.setState({scale: 1, tx: 0, ty: 0});
  }

  private onKeyDown = (evt: KeyboardEvent): void => {
    if (evt.key === 'Escape') {
      this.props.close();
      return;
    }
    if (evt.key === '+' || evt.key === '=') {
      this.zoomBy(STEP);
    } else if (evt.key === '-' || evt.key === '_') {
      this.zoomBy(1 / STEP);
    } else if (evt.key === '0') {
      this.reset();
    }
  };
}
