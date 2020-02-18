import {ipcRenderer} from 'electron';
import PromisePool from 'es6-promise-pool';
import {RootState} from '../redux/store';

// TODO: set num by isDev
const CONCURRENT = 7;

/** Returns a pool of modifiers to run. */
export function getPool<T, S>(
  store: RootState,
  items: T[],
  prefix: string,
  getName: (item: T) =>  string,
  modifyFunc: (store: RootState, item: T) =>  Promise<S>,
): PromisePool<void | S> {
  let index = 0;
  ipcRenderer.send('extension-update', {
    items: items.length,
    type: 'start-section',
  });
  return new PromisePool<void | S>(() => {
    const item = items[index];
    if (!item) {
      return;
    }
    const id = index++;
    const name = getName(item);
    ipcRenderer.send('extension-update', {
      id: prefix + id,
      name,
      type: 'start-item',
    });
    const result = modifyFunc(store, item);
    result.then(() => {
      ipcRenderer.send('extension-update', {
        id: prefix + id,
        name,
        type: 'end-item',
      });
    });
    return result;
  }, CONCURRENT);
}
