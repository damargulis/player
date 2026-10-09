import electron from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
// import {remote} from 'electron';
// import isDev from 'electron-is-dev';

export const BACKUP_TIME = 1000 * 60 * 60 * 24;

let isDev;
if (typeof electron === 'string') {
  isDev = true;
} else {
  const app = electron.app || electron.remote.app;
  const isEnvSet = 'ELECTRON_IS_DEV' in process.env;
  const getFromEnv = parseInt(process.env.ELECTRON_IS_DEV as string, 10) === 1;
  isDev = isEnvSet ? getFromEnv : !app.isPackaged;
}
export const IS_DEV = isDev;

// Unit tests dispatch real library actions, and the library reducer persists on every one of
// them (see reducers/library.tsx), so tests must never resolve DATA_DIR to a real library.
const IS_TEST = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

function testDataDir(): string {
  const dir = path.join(os.tmpdir(), `mymusic-test-${process.pid}`);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {recursive: true});
  }
  return dir;
}

function resolveDataDir(): string {
  if (IS_TEST) {
    return testDataDir();
  }
  return isDev ? './data' : electron.remote.app.getPath('userData') + '/data';
}

export const DATA_DIR = resolveDataDir();
export const DEFAULT_VOLUME = isDev ? .1 : 1;
