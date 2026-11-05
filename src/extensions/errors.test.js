import {ExtensionError, setError, withError} from './errors';

/**
 * ALBUM_ART and PIC state a fact about the entity — it has a picture or it does not — but were
 * recorded as "a download failed". In this library that had drifted both ways: 257 of the 267
 * albums flagged "No album art found" had art, and 34 albums with none were flagged with
 * nothing. Artists were wrong 56 and 78 ways. So both are derived through these.
 */
describe('withError', () => {
  it('adds the error when the thing is missing', () => {
    expect(withError([], ExtensionError.ALBUM_ART, true)).toEqual([ExtensionError.ALBUM_ART]);
  });

  it('removes the error when the thing is present', () => {
    expect(withError([ExtensionError.ALBUM_ART], ExtensionError.ALBUM_ART, false)).toEqual([]);
  });

  it('does not duplicate an error that is already there', () => {
    expect(withError([ExtensionError.ALBUM_ART], ExtensionError.ALBUM_ART, true))
      .toEqual([ExtensionError.ALBUM_ART]);
  });

  it('leaves other errors alone', () => {
    const errors = [ExtensionError.GENRE, ExtensionError.ALBUM_ART, ExtensionError.YEAR];
    expect(withError(errors, ExtensionError.ALBUM_ART, false))
      .toEqual([ExtensionError.GENRE, ExtensionError.YEAR]);
  });

  it('does not mutate the array it was given', () => {
    const errors = [ExtensionError.ALBUM_ART];
    withError(errors, ExtensionError.ALBUM_ART, false);
    expect(errors).toEqual([ExtensionError.ALBUM_ART]);
  });
});

describe('setError', () => {
  it('adds and removes in place', () => {
    const item = {errors: []};
    setError(item, ExtensionError.PIC, true);
    expect(item.errors).toEqual([ExtensionError.PIC]);
    setError(item, ExtensionError.PIC, false);
    expect(item.errors).toEqual([]);
  });

  /** A failed request against an entity that already has a picture is not a missing picture. */
  it('clears the error when the entity has the thing, however the fetch went', () => {
    const artist = {artFile: '/data/pic.png', errors: [ExtensionError.PIC]};
    setError(artist, ExtensionError.PIC, !artist.artFile);
    expect(artist.errors).toEqual([]);
  });

  it('sets the error when the entity does not, however the fetch went', () => {
    const album = {albumArtFile: undefined, errors: []};
    setError(album, ExtensionError.ALBUM_ART, !album.albumArtFile);
    expect(album.errors).toEqual([ExtensionError.ALBUM_ART]);
  });
});
