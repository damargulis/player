import {DATA_DIR} from '../constants';
import fs from 'fs';
import {longerSide, sizeFromBuffer} from './imageSize';
import shortid from 'shortid';

/**
 * Writing album art and artist pictures without making them worse.
 *
 * Four places download images into `data/`: the Wikipedia infobox image and the MusicBrainz
 * cover art, for both albums and artists. Every one of them used to write unconditionally over
 * whatever was there, which meant the extensions silently fought each other — running
 * MusicBrainz after the Cover Art extension replaced 1200px art with its own `front-500`, and
 * a Wikipedia run replaced either with whatever low-resolution fair-use thumbnail the infobox
 * happened to carry.
 *
 * So the rule is one-way: an image is only written when it is larger than what is already on
 * disk. Sizes are compared on the **longer** side, matching how the Cover Art Archive scales.
 */

export interface ArtWrite {
  /** Where the art lives now — the existing file when nothing was written. */
  path: string;
  wrote: boolean;
}

/**
 * Writes `data` over `currentPath` only if it is bigger, or to a fresh path if there is none.
 *
 * Unreadable *incoming* data is never written: that is what would have stopped an HTML error
 * page becoming one album's cover, which is what happened and is still on disk. Unreadable
 * data already on disk counts as zero, so that album does get repaired.
 */
export function writeIfBigger(currentPath: string | undefined, data: Buffer): ArtWrite {
  const incoming = sizeFromBuffer(data);
  if (!incoming) {
    return {path: currentPath || '', wrote: false};
  }
  const current = longerSide(currentPath);
  if (Math.max(incoming.width, incoming.height) <= current) {
    return {path: currentPath as string, wrote: false};
  }
  const path = currentPath || `${DATA_DIR}/${shortid.generate()}.png`;
  fs.writeFileSync(path, data);
  return {path, wrote: true};
}

/**
 * Fetches an image and writes it only if it improves on what is there.
 *
 * Checks `res.ok` before reading the body, which the old `downloadImage` did not — an error
 * page was handed straight to `writeFileSync` as if it were an image. Rejects on a bad
 * response so callers keep recording the failure the way they already do.
 */
export function downloadIfBigger(url: string, currentPath?: string): Promise<ArtWrite> {
  if (!url) {
    return Promise.reject(new Error('No image url'));
  }
  return fetch(url).then((res) => {
    if (!res.ok) {
      return Promise.reject(new Error(`Image request failed: ${res.status}`));
    }
    return res.arrayBuffer();
  }).then((data) => writeIfBigger(currentPath, Buffer.from(data)));
}
