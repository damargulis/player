import {artistStepNames, stepNames} from './runAll';

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

/**
 * An artist run covers the artist, their albums' art and all their tracks, so it carries the
 * same mbid-before-cover-art dependency and has to stay in step with the album version.
 */
describe('runAll artist step order', () => {
  const names = artistStepNames();

  it('runs the same five extensions as an album run', () => {
    expect(names).toEqual(stepNames());
  });

  it('runs MusicBrainz before Cover art', () => {
    expect(names.indexOf('MusicBrainz')).toBeLessThan(names.indexOf('Cover art'));
  });
});
