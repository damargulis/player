import {remote} from 'electron';
import isDev from 'electron-is-dev';

export const DATA_DIR = isDev ? './data' : remote.app.getPath('userData') + '/data';
