import {shouldFetch} from './main';

/**
 * Deciding whether an album is worth a request is the whole cost model of this extension: a
 * full pass is ~2,000 requests and ~458MB, so getting this wrong means re-downloading the
 * library every run.
 *
 * `currentPx` is the **longer** side of the art on disk, because that is the dimension the
 * Cover Art Archive scales: `front-1200` on a 1400x1160 cover returns 1200x994. Judging by the
 * shorter side called covers already at the Archive's maximum "too small" — measured against
 * real albums, almost every one came back under 1200 on its short edge.
 */
const album = (extra) => Object.assign({
  albumArtFile: '/data/art.png',
  artistIds: [],
  errors: [],
  favorites: [],
  genreIds: [],
  id: 'album-1',
  mbid: 'mb-1',
  name: 'Album',
  playCount: 0,
  skipCount: 0,
  trackIds: [],
  year: 1999,
}, extra || {});

describe('shouldFetch', () => {
  it('asks for art when there is none', () => {
    expect(shouldFetch(album({albumArtFile: undefined}), 0)).toEqual(true);
  });

  it('asks when the art on disk is small', () => {
    expect(shouldFetch(album(), 220)).toEqual(true);
    expect(shouldFetch(album(), 500)).toEqual(true);
  });

  it('leaves art already at the target alone', () => {
    expect(shouldFetch(album(), 1200)).toEqual(false);
    expect(shouldFetch(album(), 3000)).toEqual(false);
  });

  it('never asks without an mbid, since there is nothing to ask with', () => {
    expect(shouldFetch(album({mbid: undefined}), 0)).toEqual(false);
  });

  /** The reason the marker exists at all. */
  it('stops asking once the Archive has given all it has', () => {
    const marked = album({coverArt: {maxPx: 800, target: 1200}});
    expect(shouldFetch(marked, 800)).toEqual(false);
  });

  it('still asks if the file is somehow smaller than what the Archive gave', () => {
    // art replaced by something worse, or the file lost; worth one request to put it right
    const marked = album({coverArt: {maxPx: 1200, target: 1200}});
    expect(shouldFetch(marked, 500)).toEqual(true);
  });

  /** Raising the target has to invalidate every marker, or the improvement never lands. */
  it('asks again when the marker was written for a smaller target', () => {
    const marked = album({coverArt: {maxPx: 500, target: 500}});
    expect(shouldFetch(marked, 500)).toEqual(true);
  });

  it('treats unreadable art as absent rather than as good enough', () => {
    // one album in this library has an HTML error page saved as its cover, which reads as 0
    expect(shouldFetch(album({coverArt: {maxPx: 1200, target: 1200}}), 0)).toEqual(true);
  });
});
