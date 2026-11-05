import {boundTo, memoize, resetBindings} from './memo';

/**
 * `mapStateToProps` built fresh closures on every call, so `connect` could never bail out and
 * every connected component re-rendered on every action — four times a second during playback,
 * for ~2.9ms of selector work each time on this library.
 */
describe('boundTo', () => {
  const library = {tracks: {a: {id: 'a'}}};
  const store = {library};
  const getTrack = (state, id) => state.library.tracks[id];

  beforeEach(() => resetBindings(library));

  it('returns the identical function while the slice is unchanged', () => {
    expect(boundTo(library, store, getTrack)).toBe(boundTo(library, store, getTrack));
  });

  it('still answers correctly through the wrapper', () => {
    expect(boundTo(library, store, getTrack)('a')).toEqual({id: 'a'});
  });

  it('gives a different function for a different selector', () => {
    const other = (state, id) => state.library.tracks[id].id;
    expect(boundTo(library, store, getTrack)).not.toBe(boundTo(library, store, other));
  });

  /** The point: a new slice must invalidate, or the data would go stale. */
  it('gives a new function when the slice changes', () => {
    const first = boundTo(library, store, getTrack);
    const newLibrary = {tracks: {a: {id: 'a2'}}};
    const second = boundTo(newLibrary, {library: newLibrary}, getTrack);
    expect(second).not.toBe(first);
    expect(second('a')).toEqual({id: 'a2'});
  });

  it('keeps separate caches per slice', () => {
    const otherLibrary = {tracks: {}};
    const a = boundTo(library, store, getTrack);
    const b = boundTo(otherLibrary, {library: otherLibrary}, getTrack);
    expect(a).not.toBe(b);
    expect(boundTo(library, store, getTrack)).toBe(a);
  });
});

describe('memoize', () => {
  it('recomputes only when an argument changes by reference', () => {
    let calls = 0;
    const filter = memoize((items, keep) => {
      calls++;
      return items.filter((item) => keep.includes(item));
    });
    const items = [1, 2, 3];
    const keep = [2, 3];
    expect(filter(items, keep)).toEqual([2, 3]);
    expect(filter(items, keep)).toEqual([2, 3]);
    expect(calls).toEqual(1);
    // the same array returned, so shallow equality holds upstream
    expect(filter(items, keep)).toBe(filter(items, keep));
  });

  it('recomputes when an argument is a new array, even with equal contents', () => {
    let calls = 0;
    const run = memoize((items) => { calls++; return items.length; });
    run([1, 2]);
    run([1, 2]);
    expect(calls).toEqual(2);
  });

  it('handles a changing argument count', () => {
    const run = memoize((...args) => args.length);
    expect(run(1)).toEqual(1);
    expect(run(1, 2)).toEqual(2);
    expect(run(1)).toEqual(1);
  });
});
