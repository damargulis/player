import fs from 'fs';

/**
 * Pixel dimensions of a PNG, JPEG or GIF, read from its header.
 *
 * The cover-art extension has to know how big the art it already has is, for 2,176 albums,
 * without decoding any of it — the renderer is the thread playing audio and drawing the UI.
 * This reads a few bytes per segment and never the pixels.
 *
 * All three formats appear in `data/` in practice: the Cover Art Archive serves JPEG, the
 * iTunes import and the Wikipedia infobox image bring PNG and occasionally GIF, and every one
 * of them is written with a `.png` name regardless, so the extension is no guide. Anything
 * else reports undefined, which callers treat as "unknown, so refetch" — and one file in this
 * library is an HTML error page saved as album art, which is exactly that case.
 */

export interface ImageSize {
  width: number;
  height: number;
}

const PNG_MAGIC = '89504e470d0a1a0a';
/** Enough for a PNG's IHDR, a GIF's screen descriptor, and a JPEG's first segment header. */
const PROBE_BYTES = 32;

/** Reads `length` bytes at `offset`, returning fewer at end of file. */
type ReadAt = (offset: number, length: number) => Buffer;

/** Start-of-frame markers carry the dimensions. DHT/JPG/DAC share the range but are not frames. */
function isFrameMarker(marker: number): boolean {
  return marker >= 0xC0 && marker <= 0xCF &&
    marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC;
}

/** Markers that stand alone with no length field, so the walk steps over just the two bytes. */
function isStandaloneMarker(marker: number): boolean {
  return marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7);
}

/**
 * Walks a JPEG's segments to the frame header.
 *
 * Seeking rather than reading a fixed window, because the distance to the frame is unbounded:
 * one cover in this library carries 17KB of EXIF and 109KB of ICC profile ahead of it, putting
 * the frame at byte 131,378. A 64KB window read that file as "not an image" and would have had
 * it re-downloaded every run.
 */
function jpegSize(readAt: ReadAt): ImageSize | undefined {
  let at = 2;
  // generous, but bounded: a file that walks this many segments is not a JPEG we can read
  for (let segment = 0; segment < 1000; segment++) {
    const head = readAt(at, 9);
    if (head.length < 4 || head[0] !== 0xFF) {
      return undefined;
    }
    const marker = head[1];
    if (marker === 0xFF) {
      // fill byte between segments
      at++;
      continue;
    }
    if (isFrameMarker(marker)) {
      return head.length < 9 ? undefined
        : {height: head.readUInt16BE(5), width: head.readUInt16BE(7)};
    }
    if (isStandaloneMarker(marker)) {
      at += 2;
      continue;
    }
    const length = head.readUInt16BE(2);
    if (length < 2) {
      return undefined;
    }
    at += 2 + length;
  }
  return undefined;
}

function sizeFrom(readAt: ReadAt): ImageSize | undefined {
  const probe = readAt(0, PROBE_BYTES);
  if (probe.length >= 24 && probe.slice(0, 8).toString('hex') === PNG_MAGIC) {
    // IHDR is always the first chunk, so width and height sit at a fixed offset
    return {height: probe.readUInt32BE(20), width: probe.readUInt32BE(16)};
  }
  if (probe.length >= 10 && probe.slice(0, 3).toString('ascii') === 'GIF') {
    // the logical screen descriptor, little-endian
    return {height: probe.readUInt16LE(8), width: probe.readUInt16LE(6)};
  }
  if (probe.length >= 4 && probe[0] === 0xFF && probe[1] === 0xD8) {
    return jpegSize(readAt);
  }
  return undefined;
}

/** For an image already in memory, such as one just downloaded. */
export function sizeFromBuffer(buf: Buffer): ImageSize | undefined {
  return sizeFrom((offset, length) => buf.slice(offset, offset + length));
}

/** The size of an image on disk, or undefined if it is missing or not a format we read. */
export function imageSize(filePath: string): ImageSize | undefined {
  let handle: number | undefined;
  try {
    handle = fs.openSync(filePath, 'r');
    const fd = handle;
    return sizeFrom((offset, length) => {
      const buf = Buffer.alloc(length);
      const read = fs.readSync(fd, buf, 0, length, offset);
      return buf.slice(0, read);
    });
  } catch (err) {
    return undefined;
  } finally {
    if (handle !== undefined) {
      fs.closeSync(handle);
    }
  }
}

/** The shorter side, which is what "how big is this cover" means for a roughly square image. */
export function shorterSide(filePath: string): number {
  const size = imageSize(filePath);
  return size ? Math.min(size.width, size.height) : 0;
}
