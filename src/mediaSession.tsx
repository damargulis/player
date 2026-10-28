import fs from 'fs';
import path from 'path';

/**
 * Feeds the OS "Now Playing" card.
 *
 * This is what an AirPlay receiver shows on the TV, and what the macOS menu bar and media keys
 * read. With nothing set, the card falls back to the page title and no art - which is why the
 * TV showed "React App" and a blank square.
 *
 * Chromium implements the MediaSession API and Electron bridges it to macOS, so setting
 * metadata here is all it takes; nothing has to know about AirPlay specifically.
 */

/**
 * The MediaSession API is newer than this project's TypeScript (3.7), whose DOM lib predates
 * it, so the shapes are declared here. Chromium 91 in Electron 13 implements all of it at
 * runtime; only the compiler needs convincing.
 */
interface MediaImageShim {
  src: string;
  sizes?: string;
  type?: string;
}

interface MediaMetadataInit {
  title?: string;
  artist?: string;
  album?: string;
  artwork?: MediaImageShim[];
}

interface MediaSessionShim {
  metadata: object | null;
  playbackState: string;
  setActionHandler(action: string, handler: (() => void) | null): void;
}

declare const MediaMetadata: new(init?: MediaMetadataInit) => object;

export interface NowPlaying {
  title: string;
  artist: string;
  album: string;
  /** Absolute path to the album art on disk, if there is any. */
  artFile?: string;
}

export interface TransportHandlers {
  play(): void;
  pause(): void;
  next(): void;
  previous(): void;
}

/**
 * Artwork above this is skipped rather than embedded.
 *
 * Art is normally ~40KB, but the library has at least one 50MB png. Turning that into a data
 * URL on every track change would be a real stall for a thumbnail nobody can see properly.
 */
export const MAX_ART_BYTES = 3 * 1024 * 1024;

const MIME: Record<string, string> = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/**
 * Album art as a data URL, or undefined.
 *
 * Deliberately not a `file://` URL: in development the page is served from localhost, and
 * Chromium will not load a file:// image into it. A data URL works the same in both dev and
 * the packaged app, where the page itself is on file://.
 */
export function artworkDataUrl(artFile?: string): string | undefined {
  if (!artFile) {
    return undefined;
  }
  try {
    const resolved = path.resolve(artFile);
    const stat = fs.statSync(resolved);
    if (!stat.isFile() || stat.size > MAX_ART_BYTES) {
      return undefined;
    }
    const type = MIME[path.extname(resolved).toLowerCase()];
    if (!type) {
      return undefined;
    }
    return `data:${type};base64,${fs.readFileSync(resolved).toString('base64')}`;
  } catch (err) {
    // missing or unreadable art is not worth failing a track change over
    return undefined;
  }
}

/** Reused across tracks on the same album, which is the common case while a record plays. */
let lastArtFile: string | undefined;
let lastArtwork: string | undefined;

function artworkFor(artFile?: string): string | undefined {
  if (artFile === lastArtFile) {
    return lastArtwork;
  }
  lastArtFile = artFile;
  lastArtwork = artworkDataUrl(artFile);
  return lastArtwork;
}

function session(): MediaSessionShim | undefined {
  if (typeof navigator === 'undefined') {
    return undefined;
  }
  return (navigator as unknown as {mediaSession?: MediaSessionShim}).mediaSession;
}

/** Registered once; the handlers are what make the TV remote and media keys work. */
export function setTransportHandlers(handlers: TransportHandlers): void {
  const media = session();
  if (!media || !media.setActionHandler) {
    return;
  }
  try {
    media.setActionHandler('play', () => handlers.play());
    media.setActionHandler('pause', () => handlers.pause());
    media.setActionHandler('nexttrack', () => handlers.next());
    media.setActionHandler('previoustrack', () => handlers.previous());
  } catch (err) {
    // an action this Chromium does not know is not fatal; the rest still register
  }
}

export function updateNowPlaying(info?: NowPlaying): void {
  const media = session();
  if (!media) {
    return;
  }
  if (!info) {
    media.metadata = null;
    return;
  }
  const artwork = artworkFor(info.artFile);
  media.metadata = new MediaMetadata({
    album: info.album,
    artist: info.artist,
    artwork: artwork ? [{sizes: '512x512', src: artwork, type: 'image/png'}] : [],
    title: info.title,
  });
}

export function setPlaybackState(playing: boolean): void {
  const media = session();
  if (!media) {
    return;
  }
  media.playbackState = playing ? 'playing' : 'paused';
}
