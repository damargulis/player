import {selectBackupsToDelete, wouldDestroyLibrary} from './library';
import fs from 'fs';
import os from 'os';
import path from 'path';

const DAY = 1000 * 60 * 60 * 24;
const NOW = 1786000000000;

function daysAgo(days) {
  return `${NOW - days * DAY}.json`;
}

test('keeps all backups from the last 30 days', () => {
  const files = [daysAgo(0), daysAgo(1), daysAgo(15), daysAgo(29)];
  expect(selectBackupsToDelete(files, NOW)).toStrictEqual([]);
});

test('thins old backups to the newest per month', () => {
  // three backups within one old month: only the newest survives
  const oldest = `${new Date(2026, 0, 5).getTime()}.json`;
  const middle = `${new Date(2026, 0, 14).getTime()}.json`;
  const newest = `${new Date(2026, 0, 28).getTime()}.json`;
  const deleted = selectBackupsToDelete([oldest, middle, newest, daysAgo(2)], NOW);
  expect(deleted).toContain(oldest);
  expect(deleted).toContain(middle);
  expect(deleted).not.toContain(newest);
});

test('keeps one backup per distinct old month', () => {
  const files = [daysAgo(45), daysAgo(75), daysAgo(105), daysAgo(135)];
  const deleted = selectBackupsToDelete(files, NOW);
  const kept = files.filter((file) => !deleted.includes(file));
  const months = new Set(kept.map((file) => {
    const date = new Date(parseInt(file, 10));
    return `${date.getFullYear()}-${date.getMonth()}`;
  }));
  expect(months.size).toBe(kept.length);
  expect(kept.length).toBeGreaterThan(0);
});

test('ignores files that are not timestamped backups', () => {
  const files = ['.DS_Store', 'notes.txt', daysAgo(500)];
  const deleted = selectBackupsToDelete(files, NOW);
  expect(deleted).not.toContain('.DS_Store');
  expect(deleted).not.toContain('notes.txt');
});

describe('wouldDestroyLibrary', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lib-guard-'));
  });

  afterEach(() => {
    fs.readdirSync(dir).forEach((f) => fs.unlinkSync(path.join(dir, f)));
    fs.rmdirSync(dir);
  });

  function write(file, bytes) {
    const p = path.join(dir, file);
    fs.writeFileSync(p, 'x'.repeat(bytes));
    return p;
  }

  it('blocks an empty library from overwriting a real one', () => {
    const file = write('library.json', 50000);
    expect(wouldDestroyLibrary({tracks: {}}, file)).toBe(true);
  });

  it('allows a real library to be written', () => {
    const file = write('library.json', 50000);
    expect(wouldDestroyLibrary({tracks: {t1: {}}}, file)).toBe(false);
  });

  it('allows an empty library when there is nothing on disk to lose', () => {
    // a genuine reset deletes the file first, so it must still be able to write
    expect(wouldDestroyLibrary({tracks: {}}, path.join(dir, 'missing.json'))).toBe(false);
    const placeholder = write('tiny.json', 80);
    expect(wouldDestroyLibrary({tracks: {}}, placeholder)).toBe(false);
  });
});
