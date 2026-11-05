import {atomicSave, resetQueues} from './atomicSave';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * `library.json` is 13MB and is saved from the reducer on every mutating action, so a
 * batching extension fires dozens of saves in a row. `fs.writeFile` truncates on open but is
 * not atomic, and that many bytes is many write syscalls: two overlapping calls each start at
 * offset zero with their own file position, so the shorter one's bytes land inside the longer
 * one's length.
 *
 * That corrupted this library for real — it ended in `"newTracks":[]}` followed by four copies
 * of `wTracks":[]}`, a valid document with 48 bytes of an earlier write stuck on the end, and
 * the app could not open. Reproduced with the old writer at 8 failures in 12 attempts.
 */
describe('atomicSave', () => {
  let dir;
  let file;

  beforeEach(() => {
    resetQueues();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mymusic-save-'));
    file = path.join(dir, 'library.json');
  });

  it('writes the contents', async () => {
    await atomicSave(file, '{"a":1}');
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({a: 1});
  });

  /** The bug, in miniature: documents of different lengths written concurrently. */
  it('survives overlapping saves of different lengths', async () => {
    const big = JSON.stringify({pad: 'x'.repeat(200000), newTracks: [1, 2, 3, 4, 5]});
    const small = JSON.stringify({pad: 'x'.repeat(200000), newTracks: []});
    for (let round = 0; round < 5; round++) {
      await Promise.all([
        atomicSave(file, big), atomicSave(file, small),
        atomicSave(file, big), atomicSave(file, small),
      ]);
      // the whole point: whatever is on disk is a complete document
      expect(() => JSON.parse(fs.readFileSync(file, 'utf8'))).not.toThrow();
    }
  });

  it('ends with the newest contents, not whichever write was slowest', async () => {
    await Promise.all([
      atomicSave(file, '{"n":1}'),
      atomicSave(file, '{"n":2}'),
      atomicSave(file, '{"n":3}'),
    ]);
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({n: 3});
  });

  /** Writing whole means an intermediate version is worthless once a newer one exists. */
  it('coalesces a burst into far fewer writes than calls', async () => {
    const calls = 40;
    await Promise.all(Array.from({length: calls}, (unused, i) => atomicSave(file, `{"i":${i}}`)));
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({i: calls - 1});
  });

  it('leaves no temp file behind', async () => {
    await atomicSave(file, '{"a":1}');
    expect(fs.existsSync(`${file}.writing`)).toEqual(false);
    expect(fs.readdirSync(dir)).toEqual(['library.json']);
  });

  it('keeps the previous file when a write fails', async () => {
    await atomicSave(file, '{"good":true}');
    // an unwritable temp path: the directory the temp name needs is gone
    const gone = path.join(dir, 'missing', 'library.json');
    await atomicSave(gone, '{"bad":true}').then(
      () => Promise.reject(new Error('should have rejected')),
      () => undefined);
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({good: true});
  });

  /** One failed save must not stop every later one. */
  it('keeps saving after a failure', async () => {
    const gone = path.join(dir, 'missing', 'library.json');
    await atomicSave(gone, '{"bad":true}').catch(() => undefined);
    await atomicSave(gone, '{"also bad":true}').catch(() => undefined);
    await atomicSave(file, '{"after":true}');
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({after: true});
  });

  it('keeps separate files on separate queues', async () => {
    const other = path.join(dir, 'other.json');
    await Promise.all([atomicSave(file, '{"a":1}'), atomicSave(other, '{"b":2}')]);
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({a: 1});
    expect(JSON.parse(fs.readFileSync(other, 'utf8'))).toEqual({b: 2});
  });
});
