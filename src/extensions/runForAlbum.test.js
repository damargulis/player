import {stepNames} from './runForAlbum';

/**
 * The order is not cosmetic. MusicBrainz is what fills in `Album.mbid`, and Cover Art has
 * nothing to ask the Archive with until that exists — on an album with no metadata, running
 * them the other way round means the cover-art step silently does nothing. 168 albums in this
 * library have no mbid, so this is the common case for exactly the albums someone would press
 * the button on.
 */
describe('runForAlbum step order', () => {
  const names = stepNames();

  it('runs all five extensions', () => {
    expect(names).toEqual(['MusicBrainz', 'Wikipedia', 'Cover art', 'Genius', 'Lyrics']);
  });

  it('runs MusicBrainz before Cover art, which depends on the mbid it fetches', () => {
    expect(names.indexOf('MusicBrainz')).toBeLessThan(names.indexOf('Cover art'));
  });

  it('runs the album-level extensions before the per-track ones', () => {
    const lastAlbumStep = Math.max(names.indexOf('MusicBrainz'), names.indexOf('Wikipedia'),
      names.indexOf('Cover art'));
    expect(lastAlbumStep).toBeLessThan(names.indexOf('Genius'));
    expect(lastAlbumStep).toBeLessThan(names.indexOf('Lyrics'));
  });
});
