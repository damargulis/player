import {createMemoryStore, removeRecursive} from './memory';
import fs from 'fs';
import os from 'os';
import path from 'path';

let dir;
let store;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dj-memory-'));
  store = createMemoryStore(dir);
});

afterEach(() => {
  removeRecursive(dir);
});

function run(input) {
  return store.execute(input);
}

test('empty root views as a listing, not an error', () => {
  const out = run({command: 'view', path: '/memories'});
  expect(out.isError).toBeUndefined();
  expect(out.content).toMatch(/^Here're the files and directories up to 2 levels deep in \/memories/);
  expect(out.content).toContain('\t/memories');
});

test('create, view with line numbers, and nested listing', () => {
  expect(run({command: 'create', path: '/memories/people/partner.md', file_text: 'loves Fleet Foxes\nhates screaming\n'}).content)
    .toBe('File created successfully at: /memories/people/partner.md');
  const view = run({command: 'view', path: '/memories/people/partner.md'});
  expect(view.content).toBe("Here's the content of /memories/people/partner.md with line numbers:\n     1\tloves Fleet Foxes\n     2\thates screaming");
  const listing = run({command: 'view', path: '/memories'}).content;
  expect(listing).toContain('/memories/people');
  expect(listing).toContain('/memories/people/partner.md');
  expect(run({command: 'view', path: '/memories/people/partner.md', view_range: [2, -1]}).content).toContain('     2\thates screaming');
});

test('str_replace requires a unique verbatim match and reports otherwise', () => {
  run({command: 'create', path: '/memories/taste.md', file_text: 'a\nb\na\n'});
  const missing = run({command: 'str_replace', path: '/memories/taste.md', old_str: 'zzz', new_str: 'y'});
  expect(missing.isError).toBe(true);
  expect(missing.content).toBe('No replacement was performed, old_str `zzz` did not appear verbatim in /memories/taste.md.');
  const dup = run({command: 'str_replace', path: '/memories/taste.md', old_str: 'a', new_str: 'y'});
  expect(dup.isError).toBe(true);
  expect(dup.content).toContain('Multiple occurrences of old_str `a` in lines: 1, 3');
  const ok = run({command: 'str_replace', path: '/memories/taste.md', old_str: 'b', new_str: 'B'});
  expect(ok.isError).toBeUndefined();
  expect(ok.content).toMatch(/^The memory file has been edited\./);
  expect(fs.readFileSync(path.join(dir, 'taste.md'), 'utf8')).toBe('a\nB\na\n');
  // omitting new_str deletes
  run({command: 'str_replace', path: '/memories/taste.md', old_str: 'B\n'});
  expect(fs.readFileSync(path.join(dir, 'taste.md'), 'utf8')).toBe('a\na\n');
});

test('insert is after the given line, 0 = top, with range errors', () => {
  run({command: 'create', path: '/memories/n.md', file_text: 'one\ntwo'});
  expect(run({command: 'insert', path: '/memories/n.md', insert_line: 0, insert_text: 'zero\n'}).content).toBe('The file /memories/n.md has been edited.');
  run({command: 'insert', path: '/memories/n.md', insert_line: 3, insert_text: 'three'});
  expect(fs.readFileSync(path.join(dir, 'n.md'), 'utf8')).toBe('zero\none\ntwo\nthree');
  const bad = run({command: 'insert', path: '/memories/n.md', insert_line: 99, insert_text: 'x'});
  expect(bad.isError).toBe(true);
  expect(bad.content).toContain('Invalid `insert_line` parameter: 99');
});

test('delete and rename, refusing to touch the root', () => {
  run({command: 'create', path: '/memories/a.md', file_text: 'x'});
  expect(run({command: 'rename', old_path: '/memories/a.md', new_path: '/memories/b.md'}).content).toBe('Successfully renamed /memories/a.md to /memories/b.md');
  run({command: 'create', path: '/memories/c.md', file_text: 'y'});
  expect(run({command: 'rename', old_path: '/memories/b.md', new_path: '/memories/c.md'}).content).toBe('Error: The destination /memories/c.md already exists');
  expect(run({command: 'delete', path: '/memories/nope.md'}).content).toBe('Error: The path /memories/nope.md does not exist');
  expect(run({command: 'delete', path: '/memories/b.md'}).content).toBe('Successfully deleted /memories/b.md');
  expect(run({command: 'delete', path: '/memories'}).isError).toBe(true);
  expect(run({command: 'rename', old_path: '/memories', new_path: '/memories/x'}).isError).toBe(true);
});

test('rejects paths that escape the memory directory', () => {
  const outside = path.join(dir, '..', 'escaped.txt');
  [
    '/memories/../escaped.txt',
    '/memories/people/../../escaped.txt',
    '/etc/passwd',
    'memories/x.md',
    '/memories/%2e%2e/escaped.txt',
    '/memories\\..\\escaped.txt',
  ].forEach((p) => {
    const out = run({command: 'create', path: p, file_text: 'pwned'});
    expect(out.isError).toBe(true);
  });
  expect(fs.existsSync(outside)).toBe(false);
  expect(run({command: 'view', path: '/memories/../'}).isError).toBe(true);
});

test('listFiles returns every file with contents for the UI', () => {
  run({command: 'create', path: '/memories/people/me.md', file_text: 'me'});
  run({command: 'create', path: '/memories/taste.md', file_text: 'taste'});
  expect(store.listFiles().map((f) => [f.path, f.content])).toStrictEqual([
    ['/memories/people/me.md', 'me'],
    ['/memories/taste.md', 'taste'],
  ]);
});
