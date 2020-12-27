import {IS_DEV} from '../constants';
import {ipcRenderer} from 'electron';
import PromisePool from 'es6-promise-pool';
import {RootState} from '../redux/store';

// TODO: set num in a smart way, use network strength?, optimize while running?
const CONCURRENT = IS_DEV ? 5 : 7;

class Pool<T, S> {
  private index: number;
  private cancel: boolean;
  constructor(
    private items: T[],
    private getMessage: (item: T) => string,
    private extensionId: string,
    private modifyFunc: (item: T) =>  Promise<S>,
  ) {
    this.index = 0;
    this.cancel = false;

    ipcRenderer.on('cancel', (evt, arg) => {
      if (arg.extensionId === this.extensionId) {
        this.cancel = true;
      }
    });
  }

  next(): void|Promise<S> {
    const item = this.items[this.index];
    this.index++;
    if (!item || this.cancel) {
      return;
    }
    const id = Math.ceil(Math.random() * 59587435927); // TODO: random enough for now lol
    const msg = this.getMessage(item);
    ipcRenderer.send('extension-update', {
      id,
      msg: 'Modifying: ' + msg,
      type: 'start-item',
      extensionId: this.extensionId,
    });
    const result = this.modifyFunc(item);
    result.then(() => {
      ipcRenderer.send('extension-update', {
        id,
        type: 'end-item',
        extensionId: this.extensionId,
      });
    });
    return result;
  }
}

/** Returns a pool of modifiers to run. */
export function getPool<T, S>(
  store: RootState,
  items: T[],
  prefix: string,
  getName: (item: T) =>  string,
  modifyFunc: (store: RootState, item: T) =>  Promise<S>,
  extensionId: string,
): PromisePool<void | S> {
  ipcRenderer.send('extension-update', {
    items: items.length,
    type: 'start-section',
    extensionId,
  });
  const pool = new Pool(items, getName, extensionId, (item: T) => modifyFunc(store, item));
  return new PromisePool(() => pool.next(), CONCURRENT);
}
