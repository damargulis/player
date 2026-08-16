import {DATA_DIR} from './constants';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as React from 'react';
import {getImgSrc} from './utils';

const THUMB_DIR = path.join(DATA_DIR, 'thumbs');
const THUMB_SIZE = 200;

const ready = new Map<string, string>();
const inFlight = new Map<string, Promise<string | undefined>>();

// TS 3.7's dom lib doesn't know createImageBitmap's resize options
type CreateBitmapResized =
  (image: Blob, options: {resizeWidth: number; resizeQuality: string}) => Promise<ImageBitmap>;

function thumbPath(file: string): string {
  const hash = crypto.createHash('sha1').update(file).digest('hex');
  return path.join(THUMB_DIR, `${hash}.png`);
}

/**
 * Full-size art (artist pics especially) can be many MB, which stalls the
 * grids while Chromium decodes them. Decode once off the main thread, save a
 * small thumbnail to disk, and serve that ever after.
 */
async function createThumb(file: string): Promise<string | undefined> {
  const dest = thumbPath(file);
  try {
    await fs.promises.access(dest);
    ready.set(file, dest);
    return dest;
  } catch {
    // not cached yet; generate below
  }
  try {
    await fs.promises.mkdir(THUMB_DIR, {recursive: true});
    const data = await fs.promises.readFile(path.resolve(file));
    const createBitmap = window.createImageBitmap as unknown as CreateBitmapResized;
    const bitmap = await createBitmap(
      new Blob([data]), {resizeWidth: THUMB_SIZE, resizeQuality: 'high'});
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return undefined;
    }
    ctx.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
      return undefined;
    }
    await fs.promises.writeFile(dest, Buffer.from(await blob.arrayBuffer()));
    ready.set(file, dest);
    return dest;
  } catch (err) {
    return undefined;
  }
}

function ensureThumb(file: string): Promise<string | undefined> {
  const cached = ready.get(file);
  if (cached) {
    return Promise.resolve(cached);
  }
  let promise = inFlight.get(file);
  if (!promise) {
    promise = createThumb(file);
    inFlight.set(file, promise);
  }
  return promise;
}

interface ArtImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  file?: string;
  fallback: string;
}

interface ArtImgState {
  src: string;
}

/**
 * An img that renders a cached thumbnail of `file`, generating it on first
 * sight; shows `fallback` until the thumbnail is ready and the original file
 * if thumbnailing fails.
 */
export default class ArtImg extends React.Component<ArtImgProps, ArtImgState> {
  private mounted = false;

  constructor(props: ArtImgProps) {
    super(props);

    this.state = {src: props.fallback};
  }

  public componentDidMount(): void {
    this.mounted = true;
    this.resolveSrc();
  }

  public componentDidUpdate(prevProps: ArtImgProps): void {
    if (prevProps.file !== this.props.file) {
      this.resolveSrc();
    }
  }

  public componentWillUnmount(): void {
    this.mounted = false;
  }

  public render(): JSX.Element {
    const {file, fallback, alt, ...imgProps} = this.props;
    return (
      <img alt={alt || 'art'} {...imgProps} src={this.state.src} />
    );
  }

  private resolveSrc(): void {
    const file = this.props.file;
    if (!file) {
      this.setState({src: this.props.fallback});
      return;
    }
    ensureThumb(file).then((thumb) => {
      if (!this.mounted || this.props.file !== file) {
        return;
      }
      this.setState({src: thumb ? getImgSrc(thumb) : getImgSrc(file)});
    });
  }
}
