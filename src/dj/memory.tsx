import {Tool} from './api';
import {DATA_DIR} from '../constants';
import fs from 'fs';
import path from 'path';
import {ToolOutcome} from './tools';

/**
 * Backend for Anthropic's client-side memory tool (`memory_20250818`). Claude sees a virtual
 * `/memories` directory; every command is validated and mapped onto a real directory under
 * DATA_DIR. Return strings follow the documented contract so the model's trained behaviour
 * (view first, keep files organised, retry after a failed str_replace) works as intended.
 */

export const MEMORY_ROOT = '/memories';
const MAX_FILE_BYTES = 64 * 1024;
const MAX_VIEW_CHARS = 16000;
const DIR_LISTING_DEPTH = 2;

/** Same commands, exposed as an ordinary tool for the MCP bridge (Claude Code can't use the native tool). */
export const MCP_MEMORY_TOOL: Tool = {
  description: `Your long-term memory: a small directory of notes under ${MEMORY_ROOT} that persists ` +
    'across sessions. ' +
    'View it at the start of every session. Commands: view (path, optional view_range [start,end]), ' +
    'create (path, file_text — overwrites), str_replace (path, old_str, optional new_str), ' +
    'insert (path, insert_line, insert_text — inserts after that line, 0 = top), delete (path), rename (old_path, new_path).',
  input_schema: {
    properties: {
      command: {
        description: 'Which operation to run',
        enum: ['view', 'create', 'str_replace', 'insert', 'delete', 'rename'],
        type: 'string',
      },
      file_text: {type: 'string', description: 'create: full file contents'},
      insert_line: {type: 'integer', description: 'insert: line number to insert after (0 = beginning)'},
      insert_text: {type: 'string', description: 'insert: text to insert'},
      new_path: {type: 'string', description: 'rename: destination path'},
      new_str: {type: 'string', description: 'str_replace: replacement text (omit to delete old_str)'},
      old_path: {type: 'string', description: 'rename: current path'},
      old_str: {type: 'string', description: 'str_replace: exact text to replace; must appear exactly once'},
      path: {type: 'string', description: `Path under ${MEMORY_ROOT}, e.g. ${MEMORY_ROOT}/people/partner.md`},
      view_range: {type: 'array', items: {type: 'integer'}, description: 'view: [start_line, end_line] (end -1 = to EOF)'},
    },
    required: ['command'],
    type: 'object',
  },
  name: 'memory',
};

export interface MemoryFile {
  path: string;
  size: number;
  content: string;
}

class MemoryError extends Error {}

function humanSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}K`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

/** Portable recursive delete (the Electron 13 runtime predates fs.rmSync). */
export function removeRecursive(target: string): void {
  if (fs.statSync(target).isDirectory()) {
    fs.readdirSync(target).forEach((name) => removeRecursive(path.join(target, name)));
    fs.rmdirSync(target);
  } else {
    fs.unlinkSync(target);
  }
}

function str(input: Record<string, unknown>, key: string): string | undefined {
  const val = input[key];
  return typeof val === 'string' ? val : undefined;
}

function numberedLines(text: string, startLine: number = 1): string {
  const lines = text.replace(/\n$/, '').split('\n');
  return lines.map((line, i) => `${String(startLine + i).padStart(6, ' ')}\t${line}`).join('\n');
}

export interface MemoryStore {
  rootDir: string;
  execute(input: Record<string, unknown>): ToolOutcome;
  listFiles(): MemoryFile[];
}

export function createMemoryStore(rootDir: string): MemoryStore {
  const root = path.resolve(rootDir);

  function ensureRoot(): void {
    if (!fs.existsSync(root)) {
      fs.mkdirSync(root, {recursive: true});
    }
  }

  /** Maps a virtual /memories path to a real one, refusing anything that could escape the root. */
  function realPath(virtual: string | undefined, label: string = 'path'): string {
    if (!virtual) {
      throw new MemoryError(`Error: ${label} is required`);
    }
    if (virtual !== MEMORY_ROOT && !virtual.startsWith(`${MEMORY_ROOT}/`)) {
      throw new MemoryError(`Error: ${label} must be under ${MEMORY_ROOT}`);
    }
    if (/%2e|%2f|%5c|\\|\0/i.test(virtual) || virtual.split('/').some((seg) => seg === '..')) {
      throw new MemoryError(`Error: invalid ${label} ${virtual}`);
    }
    const relative = virtual.slice(MEMORY_ROOT.length).replace(/^\/+/, '');
    const resolved = path.resolve(root, relative);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      throw new MemoryError(`Error: ${label} ${virtual} is outside ${MEMORY_ROOT}`);
    }
    return resolved;
  }

  function toVirtual(real: string): string {
    const rel = path.relative(root, real).split(path.sep).join('/');
    return rel ? `${MEMORY_ROOT}/${rel}` : MEMORY_ROOT;
  }

  function listDir(dir: string, depth: number, out: string[]): void {
    fs.readdirSync(dir).filter((name) => !name.startsWith('.') && name !== 'node_modules').sort().forEach((name) => {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      out.push(`${humanSize(stat.size)}\t${toVirtual(full)}`);
      if (stat.isDirectory() && depth > 1) {
        listDir(full, depth - 1, out);
      }
    });
  }

  function readText(real: string, virtual: string): string {
    if (!fs.existsSync(real) || fs.statSync(real).isDirectory()) {
      throw new MemoryError(`Error: The path ${virtual} does not exist. Please provide a valid path.`);
    }
    return fs.readFileSync(real, 'utf8');
  }

  function writeText(real: string, virtual: string, text: string): void {
    if (Buffer.byteLength(text, 'utf8') > MAX_FILE_BYTES) {
      throw new MemoryError(`Error: ${virtual} would exceed the ${humanSize(MAX_FILE_BYTES)} limit; split it into smaller files.`);
    }
    fs.mkdirSync(path.dirname(real), {recursive: true});
    fs.writeFileSync(real, text, 'utf8');
  }

  function view(input: Record<string, unknown>): string {
    const virtual = str(input, 'path') || MEMORY_ROOT;
    const real = realPath(virtual);
    if (!fs.existsSync(real)) {
      throw new MemoryError(`The path ${virtual} does not exist. Please provide a valid path.`);
    }
    if (fs.statSync(real).isDirectory()) {
      const lines = [`${humanSize(fs.statSync(real).size)}\t${virtual}`];
      listDir(real, DIR_LISTING_DEPTH, lines);
      return `Here're the files and directories up to ${DIR_LISTING_DEPTH} levels deep in ${virtual}, ` +
        `excluding hidden items and node_modules:\n${lines.join('\n')}`;
    }
    const text = fs.readFileSync(real, 'utf8');
    const range = input.view_range;
    if (Array.isArray(range) && range.length === 2 && typeof range[0] === 'number') {
      const lines = text.replace(/\n$/, '').split('\n');
      const start = Math.max(1, range[0]);
      const end = range[1] === -1 ? lines.length : Math.min(lines.length, Number(range[1]));
      if (start > lines.length || end < start) {
        throw new MemoryError(`Error: Invalid view_range [${range[0]}, ${range[1]}] for a file with ${lines.length} lines`);
      }
      return `Here's the content of ${virtual} with line numbers:\n${numberedLines(lines.slice(start - 1, end).join('\n'), start)}`;
    }
    const truncated = text.length > MAX_VIEW_CHARS;
    const body = numberedLines(truncated ? text.slice(0, MAX_VIEW_CHARS) : text);
    const note = truncated ? `\n[Truncated at ${MAX_VIEW_CHARS} characters; use view_range to read the rest]` : '';
    return `Here's the content of ${virtual} with line numbers:\n${body}${note}`;
  }

  function create(input: Record<string, unknown>): string {
    const virtual = str(input, 'path');
    const real = realPath(virtual);
    if (real === root) {
      throw new MemoryError(`Error: cannot create ${MEMORY_ROOT} itself`);
    }
    writeText(real, virtual as string, str(input, 'file_text') || '');
    return `File created successfully at: ${virtual}`;
  }

  function strReplace(input: Record<string, unknown>): string {
    const virtual = str(input, 'path') as string;
    const real = realPath(virtual);
    const oldStr = str(input, 'old_str');
    if (oldStr === undefined || oldStr === '') {
      throw new MemoryError('Error: old_str is required');
    }
    const text = readText(real, virtual);
    const occurrences = text.split(oldStr).length - 1;
    if (occurrences === 0) {
      throw new MemoryError(
        `No replacement was performed, old_str \`${oldStr}\` did not appear verbatim in ${virtual}.`);
    }
    if (occurrences > 1) {
      const lineNumbers: number[] = [];
      text.split('\n').forEach((line, i) => {
        if (line.includes(oldStr)) {
          lineNumbers.push(i + 1);
        }
      });
      throw new MemoryError(`No replacement was performed. Multiple occurrences of old_str \`${oldStr}\` in lines: ` +
        `${lineNumbers.join(', ')}. Please ensure it is unique`);
    }
    const newStr = str(input, 'new_str') || '';
    const index = text.indexOf(oldStr);
    const updated = text.slice(0, index) + newStr + text.slice(index + oldStr.length);
    writeText(real, virtual, updated);
    const replacedLine = updated.slice(0, index).split('\n').length;
    const lines = updated.replace(/\n$/, '').split('\n');
    const start = Math.max(1, replacedLine - 2);
    const end = Math.min(lines.length, replacedLine + newStr.split('\n').length + 1);
    return `The memory file has been edited.\n${numberedLines(lines.slice(start - 1, end).join('\n'), start)}`;
  }

  function insert(input: Record<string, unknown>): string {
    const virtual = str(input, 'path') as string;
    const real = realPath(virtual);
    if (!fs.existsSync(real) || fs.statSync(real).isDirectory()) {
      throw new MemoryError(`Error: The path ${virtual} does not exist`);
    }
    const lines = fs.readFileSync(real, 'utf8').split('\n');
    const line = input.insert_line;
    if (typeof line !== 'number' || line < 0 || line > lines.length) {
      throw new MemoryError(`Error: Invalid \`insert_line\` parameter: ${line}. ` +
        `It should be within the range of lines of the file: [0, ${lines.length}]`);
    }
    lines.splice(line, 0, (str(input, 'insert_text') || '').replace(/\n$/, ''));
    writeText(real, virtual, lines.join('\n'));
    return `The file ${virtual} has been edited.`;
  }

  function remove(input: Record<string, unknown>): string {
    const virtual = str(input, 'path') as string;
    const real = realPath(virtual);
    if (real === root) {
      throw new MemoryError(`Error: cannot delete ${MEMORY_ROOT} itself`);
    }
    if (!fs.existsSync(real)) {
      throw new MemoryError(`Error: The path ${virtual} does not exist`);
    }
    removeRecursive(real);
    return `Successfully deleted ${virtual}`;
  }

  function rename(input: Record<string, unknown>): string {
    const oldVirtual = str(input, 'old_path') as string;
    const newVirtual = str(input, 'new_path') as string;
    const oldReal = realPath(oldVirtual, 'old_path');
    const newReal = realPath(newVirtual, 'new_path');
    if (oldReal === root || newReal === root) {
      throw new MemoryError(`Error: cannot rename ${MEMORY_ROOT} itself`);
    }
    if (!fs.existsSync(oldReal)) {
      throw new MemoryError(`Error: The path ${oldVirtual} does not exist`);
    }
    if (fs.existsSync(newReal)) {
      throw new MemoryError(`Error: The destination ${newVirtual} already exists`);
    }
    fs.mkdirSync(path.dirname(newReal), {recursive: true});
    fs.renameSync(oldReal, newReal);
    return `Successfully renamed ${oldVirtual} to ${newVirtual}`;
  }

  function execute(input: Record<string, unknown>): ToolOutcome {
    try {
      ensureRoot();
      switch (str(input, 'command')) {
      case 'view':
        return {content: view(input)};
      case 'create':
        return {content: create(input)};
      case 'str_replace':
        return {content: strReplace(input)};
      case 'insert':
        return {content: insert(input)};
      case 'delete':
        return {content: remove(input)};
      case 'rename':
        return {content: rename(input)};
      default:
        return {content: `Error: unknown command ${input.command}`, isError: true};
      }
    } catch (err) {
      if (err instanceof MemoryError) {
        return {content: err.message, isError: true};
      }
      return {content: `Error: ${err instanceof Error ? err.message : String(err)}`, isError: true};
    }
  }

  function collect(dir: string, out: MemoryFile[]): void {
    fs.readdirSync(dir).filter((name) => !name.startsWith('.')).sort().forEach((name) => {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        collect(full, out);
      } else {
        out.push({content: fs.readFileSync(full, 'utf8'), path: toVirtual(full), size: stat.size});
      }
    });
  }

  function listFiles(): MemoryFile[] {
    ensureRoot();
    const out: MemoryFile[] = [];
    collect(root, out);
    return out;
  }

  return {execute, listFiles, rootDir: root};
}

let defaultStore: MemoryStore | undefined;

/** The app's memory store, under DATA_DIR so it sits next to the library and its art. */
export function getMemoryStore(): MemoryStore {
  if (!defaultStore) {
    defaultStore = createMemoryStore(path.join(DATA_DIR, 'dj-memories'));
  }
  return defaultStore;
}
