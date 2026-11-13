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

describe('mixed album/artist targets', () => {
  const {ALBUM_TARGET, ARTIST_TARGET, albumTarget, artistTarget} = require('./runAll');

  it('tags each kind so one list can drive both runners', () => {
    expect(albumTarget('al1')).toBe(`${ALBUM_TARGET}al1`);
    expect(artistTarget('ar1')).toBe(`${ARTIST_TARGET}ar1`);
  });

  /**
   * The ids are shortids, so an untagged list would be ambiguous — and the New Tracks sweep
   * needs one list, because the button that drives it counts, captures and reports progress
   * over exactly one.
   */
  it('keeps the two kinds distinguishable', () => {
    expect(albumTarget('x')).not.toBe(artistTarget('x'));
    expect(albumTarget('x').startsWith(ALBUM_TARGET)).toBe(true);
    expect(artistTarget('x').startsWith(ARTIST_TARGET)).toBe(true);
  });

  it('round-trips an id containing the other prefix', () => {
    const id = 'artist:weird';
    expect(albumTarget(id).slice(ALBUM_TARGET.length)).toBe(id);
  });
});

describe('describeTargets', () => {
  const {albumTarget, artistTarget, describeTargets} = require('./runAll');

  it('names both kinds', () => {
    expect(describeTargets([albumTarget('a'), albumTarget('b'), artistTarget('c')]))
      .toBe('2 albums and 1 artist');
  });

  it('singularises each independently', () => {
    expect(describeTargets([albumTarget('a'), artistTarget('b'), artistTarget('c')]))
      .toBe('1 album and 2 artists');
  });

  it('leaves out a kind that is not there', () => {
    expect(describeTargets([albumTarget('a'), albumTarget('b')])).toBe('2 albums');
    expect(describeTargets([artistTarget('a')])).toBe('1 artist');
  });

  it('is empty when there is nothing, which is when the button is disabled', () => {
    expect(describeTargets([])).toBe('');
  });
});
