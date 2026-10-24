import {
  BACKUP_INTERVAL_MS, BackupRefused, isDue, objectNameFor, readLibraryForBackup,
} from './cloudBackup';
import {DATA_DIR} from '../constants';
import fs from 'fs';

const LIBRARY = `${DATA_DIR}/library.json`;

function writeLibrary(obj) {
  fs.writeFileSync(LIBRARY, typeof obj === 'string' ? obj : JSON.stringify(obj));
}

afterEach(() => {
  if (fs.existsSync(LIBRARY)) {
    fs.unlinkSync(LIBRARY);
  }
});

describe('what gets uploaded', () => {
  it('accepts a library with tracks', () => {
    writeLibrary({tracks: {t1: {}, t2: {}}, albums: {}});
    expect(readLibraryForBackup().trackCount).toBe(2);
  });

  it('refuses an empty library', () => {
    // this app once wrote an 80-byte empty library over a good one; copying that
    // offsite would turn a recoverable glitch into a destroyed backup set
    writeLibrary({tracks: {}, albums: {}, artists: {}});
    expect(() => readLibraryForBackup()).toThrow(BackupRefused);
    expect(() => readLibraryForBackup()).toThrow(/no tracks/);
  });

  it('refuses a corrupt library', () => {
    writeLibrary('{"tracks": {"t1": ');
    expect(() => readLibraryForBackup()).toThrow(/not valid JSON/);
  });

  it('refuses a missing library rather than uploading nothing', () => {
    expect(() => readLibraryForBackup()).toThrow(BackupRefused);
  });
});

describe('scheduling', () => {
  it('is due when it has never run', () => {
    expect(isDue({})).toBe(true);
  });

  it('is not due again straight away', () => {
    const now = Date.now();
    expect(isDue({lastSuccessAt: now}, now)).toBe(false);
    expect(isDue({lastSuccessAt: now - BACKUP_INTERVAL_MS + 1000}, now)).toBe(false);
  });

  it('is due once the interval has passed', () => {
    const now = Date.now();
    expect(isDue({lastSuccessAt: now - BACKUP_INTERVAL_MS - 1}, now)).toBe(true);
  });

  it('a failed run does not count as success', () => {
    expect(isDue({lastRunAt: Date.now(), lastError: 'boom'})).toBe(true);
  });
});

describe('object names', () => {
  it('are timestamped, because the key cannot replace an existing object', () => {
    const a = objectNameFor('library', new Date('2026-10-24T18:42:34.668Z'));
    expect(a).toBe('library/2026-10-24T18-42-34-668Z.json');
  });

  it('differ between runs', () => {
    const a = objectNameFor('library', new Date('2026-10-24T18:42:34.668Z'));
    const b = objectNameFor('library', new Date('2026-10-25T18:42:34.668Z'));
    expect(a).not.toBe(b);
  });
});
