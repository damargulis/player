import {remote} from 'electron';
import isDev from 'electron-is-dev';

export const BACKUP_TIME = 1000 * 60 * 60 * 24;

export const DATA_DIR = isDev ? './data' : remote.app.getPath('userData') + '/data';
