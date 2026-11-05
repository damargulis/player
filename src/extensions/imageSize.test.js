import {imageSize, shorterSide, sizeFromBuffer} from './imageSize';
import fs from 'fs';
import os from 'os';
import path from 'path';

/** A minimal but structurally real PNG header: magic, then an IHDR carrying the dimensions. */
function pngHeader(width, height) {
  const buf = Buffer.alloc(24);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

/**
 * JPEG with one skipped APP0 segment before the SOF0, which is the shape of a real file.
 *
 * The segment is 18 bytes: two for the marker plus the 16 the length field declares, which
 * counts itself. Getting that wrong leaves stray bytes between segments — tolerable only to a
 * reader that rescans for the next marker, and rescanning risks finding a false frame inside
 * EXIF data, so this is well-formed and the reader is strict.
 */
function jpegHeader(width, height) {
  const app0 = Buffer.alloc(18);
  app0.writeUInt16BE(0xFFE0, 0);
  app0.writeUInt16BE(16, 2);
  const sof = Buffer.alloc(11);
  sof.writeUInt16BE(0xFFC0, 0);
  sof.writeUInt16BE(8, 2);
  sof.writeUInt8(8, 4);
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xFF, 0xD8]), app0, sof]);
}

describe('sizeFromBuffer', () => {
  it('reads a PNG', () => {
    expect(sizeFromBuffer(pngHeader(1200, 1200))).toEqual({height: 1200, width: 1200});
  });

  it('reads a JPEG, skipping the segments before the frame', () => {
    expect(sizeFromBuffer(jpegHeader(1400, 1160))).toEqual({height: 1160, width: 1400});
  });

  /** A progressive JPEG uses SOF2; the dimensions live in the same place. */
  it('reads a progressive JPEG', () => {
    const buf = jpegHeader(640, 480);
    buf.writeUInt16BE(0xFFC2, 22);
    expect(sizeFromBuffer(buf)).toEqual({height: 480, width: 640});
  });

  it('is not fooled by a marker that only looks like a frame', () => {
    // 0xC4 is a Huffman table, not a frame; walking it as one would read garbage
    const buf = jpegHeader(300, 300);
    buf.writeUInt16BE(0xFFC4, 2);
    buf.writeUInt16BE(16, 4);
    expect(sizeFromBuffer(buf)).toEqual({height: 300, width: 300});
  });

  it('reads a GIF, which the iTunes import leaves behind named .png', () => {
    const buf = Buffer.alloc(10);
    buf.write('GIF89a', 0, 'ascii');
    buf.writeUInt16LE(220, 6);
    buf.writeUInt16LE(221, 8);
    expect(sizeFromBuffer(buf)).toEqual({height: 221, width: 220});
  });

  /**
   * A real cover in this library carries 17KB of EXIF and 109KB of ICC profile, putting the
   * frame header at byte 131,378. A fixed read window read it as "not an image".
   */
  it('walks past segments far larger than any probe window', () => {
    const app1 = Buffer.alloc(2 + 65535);
    app1.writeUInt16BE(0xFFE1, 0);
    app1.writeUInt16BE(65535, 2);
    const app2 = Buffer.alloc(2 + 65535);
    app2.writeUInt16BE(0xFFE2, 0);
    app2.writeUInt16BE(65535, 2);
    // SOI, then two maximal segments, then the frame — jpegHeader's own frame starts at byte 20
    const buf = Buffer.concat([Buffer.from([0xFF, 0xD8]), app1, app2,
      jpegHeader(1200, 1200).slice(20)]);
    expect(buf.length).toBeGreaterThan(131000);
    expect(sizeFromBuffer(buf)).toEqual({height: 1200, width: 1200});
  });

  it('steps over a fill byte and a standalone marker', () => {
    const buf = Buffer.concat([
      Buffer.from([0xFF, 0xD8, 0xFF, 0xFF, 0xFF, 0xD0]), jpegHeader(300, 300).slice(2)]);
    expect(sizeFromBuffer(buf)).toEqual({height: 300, width: 300});
  });

  it('returns undefined for something that is neither', () => {
    expect(sizeFromBuffer(Buffer.from('not an image at all'))).toBeUndefined();
    // one album's art file in this library really is a saved HTML error page
    expect(sizeFromBuffer(Buffer.from('<!doctype html><html><body>404'))).toBeUndefined();
  });

  it('returns undefined rather than throwing on a truncated file', () => {
    expect(sizeFromBuffer(Buffer.from([0xFF, 0xD8, 0xFF]))).toBeUndefined();
    expect(sizeFromBuffer(pngHeader(500, 500).slice(0, 12))).toBeUndefined();
  });
});

describe('imageSize', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mymusic-art-'));

  it('reads a file off disk', () => {
    const file = path.join(dir, 'cover.png');
    fs.writeFileSync(file, pngHeader(1200, 1200));
    expect(imageSize(file)).toEqual({height: 1200, width: 1200});
    expect(shorterSide(file)).toEqual(1200);
  });

  it('reports 0 for a missing file, so a caller refetches rather than crashing', () => {
    expect(imageSize(path.join(dir, 'nope.png'))).toBeUndefined();
    expect(shorterSide(path.join(dir, 'nope.png'))).toEqual(0);
  });

  it('takes the shorter side of a non-square cover', () => {
    const file = path.join(dir, 'wide.jpg');
    fs.writeFileSync(file, jpegHeader(1400, 1160));
    expect(shorterSide(file)).toEqual(1160);
  });
});
