import {ExtensionError, MetaSource, recordSource, setError, withError, withSourceErrors} from './errors';

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

describe('recordSource', () => {
  /**
   * The point of the per-source record: genres arrive from the iTunes import too, so the error
   * cannot be derived from whether `genreIds` is populated the way the art one is. It has to
   * mean "no source that actually knows could find any".
   */
  it('clears the error once either source finds genres', () => {
    const album = {errors: [], genreIds: ['imported-rock']};
    recordSource(album, 'genres', MetaSource.MUSICBRAINZ, false);
    expect(album.errors).toEqual([ExtensionError.GENRE]);
    recordSource(album, 'genres', MetaSource.WIKIPEDIA, true);
    expect(album.errors).toEqual([]);
  });

  /** The bug this replaces: MusicBrainz runs first, so a bare page used to erase its answer. */
  it('does not let a later source erase what an earlier one found', () => {
    const album = {errors: []};
    recordSource(album, 'genres', MetaSource.MUSICBRAINZ, true);
    recordSource(album, 'genres', MetaSource.WIKIPEDIA, false);
    expect(album.errors).toEqual([]);
    expect(album.metaSources.genres).toEqual([MetaSource.MUSICBRAINZ]);
  });

  it('brings the error back when the source that had it stops finding it', () => {
    const album = {errors: []};
    recordSource(album, 'genres', MetaSource.MUSICBRAINZ, true);
    recordSource(album, 'genres', MetaSource.MUSICBRAINZ, false);
    expect(album.errors).toEqual([ExtensionError.GENRE]);
  });

  it('records a source once however often it reports', () => {
    const album = {errors: []};
    recordSource(album, 'genres', MetaSource.WIKIPEDIA, true);
    recordSource(album, 'genres', MetaSource.WIKIPEDIA, true);
    expect(album.metaSources.genres).toEqual([MetaSource.WIKIPEDIA]);
  });

  it('keeps genres and year apart', () => {
    const album = {errors: []};
    recordSource(album, 'genres', MetaSource.MUSICBRAINZ, true);
    recordSource(album, 'year', MetaSource.MUSICBRAINZ, false);
    expect(album.errors).toEqual([ExtensionError.YEAR]);
    expect(album.metaSources).toEqual({genres: [MetaSource.MUSICBRAINZ], year: []});
  });
});

describe('withSourceErrors', () => {
  it('re-derives a stale flag from the stored provenance', () => {
    // 57 of the 82 albums flagged "No genres found" in this library have genres
    expect(withSourceErrors([ExtensionError.GENRE], {genres: [MetaSource.MUSICBRAINZ]}))
      .toEqual([]);
  });

  it('adds the flag when every source that reported came up empty', () => {
    expect(withSourceErrors([], {genres: []})).toEqual([ExtensionError.GENRE]);
  });

  /** Before the first run there is no provenance, so the stored flag is left exactly as it is. */
  it('says nothing about a field no source has reported on', () => {
    expect(withSourceErrors([ExtensionError.GENRE], undefined)).toEqual([ExtensionError.GENRE]);
    expect(withSourceErrors([], {year: []})).toEqual([ExtensionError.YEAR]);
    expect(withSourceErrors([ExtensionError.GENRE], {year: ['wikipedia']}))
      .toEqual([ExtensionError.GENRE]);
  });

  it('leaves unrelated errors alone', () => {
    expect(withSourceErrors([ExtensionError.NO_MATCH], {genres: [MetaSource.WIKIPEDIA]}))
      .toEqual([ExtensionError.NO_MATCH]);
  });
});
