import {remote} from 'electron';
import isDev from 'electron-is-dev';

// TODO: put this somewhere better
// images should come from:
// https://thenounproject.com/coquet_adrien/collection/
// music-media-player-control-play-multimedia-record/
// if possible

export const DATA_DIR = isDev ? './data' : remote.app.getPath('userData') + '/data';
