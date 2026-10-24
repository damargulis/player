import {DATA_DIR} from '../constants';
import fs from 'fs';
import {
  isMusicBackupDue,
  MAX_BYTES_PER_RUN,
  MAX_FILES_PER_RUN,
  MUSIC_BACKUP_INTERVAL_MS,
  normalizeTrackPath,
  objectNameForTrack,
  pendingFiles,
} from './musicBackup';
import os from 'os';
import path from 'path';

const HOME = os.homedir();

describe('object naming', () => {
  // This is the interop contract with scripts/backup-music.js: both write the same manifest
  // and must agree byte-for-byte on names, or each would re-upload what the other finished.
  it('mirrors the filesystem under music/, relative to home', () => {
    expect(objectNameForTrack(`${HOME}/Music/Artist/Album/01 Song.mp3`))
      .toEqual('music/Music/Artist/Album/01 Song.mp3');
  });

  it('keeps spaces and punctuation literal so a restore is a plain download', () => {
    expect(objectNameForTrack(`${HOME}/Music/Sigur Rós/( )/02 Untitled.mp3`))
      .toEqual('music/Music/Sigur Rós/( )/02 Untitled.mp3');
  });
});

describe('normalizeTrackPath', () => {
  it('strips the file:// iTunes writes', () => {
    expect(normalizeTrackPath('file:///Users/x/Music/a.mp3')).toEqual('/Users/x/Music/a.mp3');
  });

  it('decodes percent-escapes', () => {
    expect(normalizeTrackPath('file:///Users/x/My%20Music/a.mp3'))
      .toEqual('/Users/x/My Music/a.mp3');
  });

  it('falls back to the raw path when the escapes are malformed', () => {
    expect(normalizeTrackPath('/Users/x/100%/a.mp3')).toEqual('/Users/x/100%/a.mp3');
  });
});

describe('isMusicBackupDue', () => {
  it('is due when it has never run', () => {
    expect(isMusicBackupDue({}, 1000)).toBe(true);
  });

  it('is not due a week after a success', () => {
    const now = 1000000000000;
    expect(isMusicBackupDue({lastSuccessAt: now - 7 * 24 * 60 * 60 * 1000}, now)).toBe(false);
  });

  it('is due a fortnight after a success', () => {
    const now = 1000000000000;
    expect(isMusicBackupDue({lastSuccessAt: now - MUSIC_BACKUP_INTERVAL_MS}, now)).toBe(true);
  });
});

describe('per-run ceilings', () => {
  // At the ~2.3MB/s measured on this connection, the byte ceiling is the one that bites first
  // for a library of ~8MB tracks. Both are pinned so neither can drift into "uploads 163GB
  // from the renderer" without a test failing.
  it('bounds a run to well under an hour of uploading', () => {
    const seconds = MAX_BYTES_PER_RUN / (2.3 * 1024 * 1024);
    expect(seconds).toBeLessThan(60 * 60);
  });

  // For this library's ~8MB median the file ceiling is the one that binds (400 x 8MB = 3.2GB,
  // inside the 4GB budget); the byte ceiling is the backstop for a run that happens to pick up
  // FLAC rips or long live sets. Both have to be survivable on their own.
  it('lets the file ceiling bind first at this library\'s median track size', () => {
    expect(MAX_FILES_PER_RUN * 8 * 1024 * 1024).toBeLessThan(MAX_BYTES_PER_RUN);
  });

  it('bounds a full-file-ceiling run of median tracks to well under an hour', () => {
    const seconds = (MAX_FILES_PER_RUN * 8 * 1024 * 1024) / (2.3 * 1024 * 1024);
    expect(seconds).toBeLessThan(60 * 60);
  });
});

describe('pendingFiles', () => {
  const dir = path.join(DATA_DIR, 'music-fixture');
  const trackFile = path.join(dir, 'song.mp3');

  beforeEach(() => {
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(trackFile, 'abcde');
    fs.writeFileSync(`${DATA_DIR}/library.json`, JSON.stringify({
      tracks: {t1: {filePath: trackFile}},
    }));
  });

  it('reports a file the manifest has never seen', async () => {
    const pending = await pendingFiles({});
    expect(pending.map((p) => p.path)).toEqual([trackFile]);
    expect(pending[0].size).toEqual(5);
  });

  it('skips a file the manifest already has at the same size', async () => {
    const pending = await pendingFiles({[objectNameForTrack(trackFile)]: {size: 5}});
    expect(pending).toEqual([]);
  });

  it('re-reports a file whose size changed, since a re-rip is new bytes', async () => {
    const pending = await pendingFiles({[objectNameForTrack(trackFile)]: {size: 999}});
    expect(pending.map((p) => p.path)).toEqual([trackFile]);
  });

  it('honours a 403-derived entry, which means the bytes are already in the bucket', async () => {
    const pending = await pendingFiles({
      [objectNameForTrack(trackFile)]: {already: true, size: 5},
    });
    expect(pending).toEqual([]);
  });

  it('ignores tracks whose file has moved off disk rather than failing the run', async () => {
    fs.writeFileSync(`${DATA_DIR}/library.json`, JSON.stringify({
      tracks: {t1: {filePath: trackFile}, t2: {filePath: `${dir}/gone.mp3`}},
    }));
    const pending = await pendingFiles({});
    expect(pending.map((p) => p.path)).toEqual([trackFile]);
  });

  it('de-duplicates tracks that point at the same file', async () => {
    fs.writeFileSync(`${DATA_DIR}/library.json`, JSON.stringify({
      tracks: {t1: {filePath: trackFile}, t2: {filePath: trackFile}},
    }));
    const pending = await pendingFiles({});
    expect(pending.length).toEqual(1);
  });
});
