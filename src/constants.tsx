import electron from 'electron';
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
export const DATA_DIR = isDev ? './data' : electron.remote.app.getPath('userData') + '/data';
export const DEFAULT_VOLUME = isDev ? .1 : 1;

