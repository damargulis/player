import {writeIfBigger} from './artFile';
import fs from 'fs';
import os from 'os';
import path from 'path';

function png(width, height) {
  const buf = Buffer.alloc(24);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

/**
 * Four downloaders write into data/ and used to overwrite each other: a MusicBrainz run after
 * the Cover Art extension replaced 1200px art with its own front-500, and Wikipedia replaced
 * either with an infobox thumbnail. The guard has to be one-way.
 */
describe('writeIfBigger', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mymusic-artfile-'));
  let seq = 0;
  const existing = (width, height) => {
    const file = path.join(dir, `art-${seq++}.png`);
    fs.writeFileSync(file, png(width, height));
    return file;
  };

  it('writes when there is no art yet', () => {
    const result = writeIfBigger(undefined, png(1200, 1200));
    expect(result.wrote).toEqual(true);
    expect(result.path).toBeTruthy();
  });

  it('writes over smaller art, in place', () => {
    const file = existing(500, 500);
    const result = writeIfBigger(file, png(1200, 1200));
    expect(result).toEqual({path: file, wrote: true});
    expect(fs.readFileSync(file).length).toEqual(24);
  });

  /** The regression the guard exists for. */
  it('refuses to replace larger art with smaller', () => {
    const file = existing(1200, 1200);
    const before = fs.readFileSync(file);
    const result = writeIfBigger(file, png(500, 500));
    expect(result).toEqual({path: file, wrote: false});
    expect(fs.readFileSync(file).equals(before)).toEqual(true);
  });

  it('refuses art of exactly the same size, so repeated runs do no work', () => {
    const file = existing(1200, 1200);
    expect(writeIfBigger(file, png(1200, 1200)).wrote).toEqual(false);
  });

  /** CAA scales the longer side, so that is the dimension to judge by. */
  it('compares the longer side', () => {
    const file = existing(1200, 994);
    // 1000x1000 has a bigger short side but a smaller long side: not an upgrade
    expect(writeIfBigger(file, png(1000, 1000)).wrote).toEqual(false);
    expect(writeIfBigger(file, png(1400, 1160)).wrote).toEqual(true);
  });

  /** One album's art file in this library really is a saved HTML error page. */
  it('never writes something that is not an image', () => {
    const file = existing(500, 500);
    const before = fs.readFileSync(file);
    const result = writeIfBigger(file, Buffer.from('<!doctype html><html>404</html>'));
    expect(result.wrote).toEqual(false);
    expect(fs.readFileSync(file).equals(before)).toEqual(true);
  });

  it('replaces art that is already unreadable', () => {
    const file = path.join(dir, 'broken.png');
    fs.writeFileSync(file, '<!doctype html><html>404</html>');
    expect(writeIfBigger(file, png(500, 500))).toEqual({path: file, wrote: true});
  });
});
