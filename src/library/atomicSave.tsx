import fs from 'fs';

/**
 * Writing a file that must never be left half-written, and never written twice at once.
 *
 * `library.json` is 13MB and is saved from the reducer on **every** mutating action, so an
 * extension that commits in batches fires dozens of saves in a row — a cover-art sweep is ~80,
 * a lyrics sweep ~190. `fs.writeFile` truncates on open but is not atomic, and that many bytes
 * is many `write` syscalls: two overlapping calls each start at offset zero with their own file
 * position, so the shorter one's bytes land inside the longer one's length.
 *
 * That is not theoretical. It left this library ending in `"newTracks":[]}` followed by four
 * copies of `wTracks":[]}` — a valid document with 48 bytes of an earlier, longer write stuck
 * on the end. `JSON.parse` got to the first `}` and threw, and the app could not open at all.
 * Reproduced with the old writer at 8 failures in 12 attempts; 0 in 12 with this one.
 *
 * Two defences, because they cover different halves of the problem. Writing to a sibling and
 * renaming makes each save atomic, so no reader ever sees a partial file and a crash mid-write
 * leaves the previous version intact. Serialising makes concurrent saves impossible in the
 * first place, and lets them coalesce.
 */

interface Queue {
  running: Promise<void>;
  /** The newest contents waiting to be written; a later save replaces it rather than queueing. */
  pending?: string;
}

const queues: Record<string, Queue> = {};

/** Exported for tests; a save in flight makes this impure. */
export function resetQueues(): void {
  Object.keys(queues).forEach((key) => delete queues[key]);
}

function writeThenRename(fileName: string, contents: string): Promise<void> {
  // A fixed temp name rather than a random one, so a failed run cannot litter the directory.
  const tempName = `${fileName}.writing`;
  return new Promise((resolve, reject) => {
    fs.writeFile(tempName, contents, (err: Error | null) => {
      if (err) {
        return reject(err);
      }
      try {
        // atomic within a filesystem, which is what makes a torn read impossible
        fs.renameSync(tempName, fileName);
      } catch (renameErr) {
        return reject(renameErr as Error);
      }
      return resolve();
    });
  });
}

/**
 * Queues a write, coalescing anything that arrives while one is running.
 *
 * Only the latest contents are worth writing: the file is written whole, so an intermediate
 * version has no value once a newer one exists. A caller still gets a promise that resolves
 * once its own state — or something newer — is on disk.
 */
export function atomicSave(fileName: string, contents: string): Promise<void> {
  const queue = queues[fileName] || {running: Promise.resolve()};
  queues[fileName] = queue;
  queue.pending = contents;
  const run = queue.running.then(() => {
    const next = queue.pending;
    queue.pending = undefined;
    if (next === undefined) {
      // a later call already wrote newer contents, so this one has nothing to do
      return Promise.resolve();
    }
    return writeThenRename(fileName, next);
  });
  // A rejection must not poison the chain, or one bad write stops every later save.
  queue.running = run.catch(() => undefined);
  return run;
}
