import {
  ExtensionError,
  MetaSource,
  recordGenres,
  recordYear,
  setError,
  unionGenres,
  withError,
  withSourceErrors,
} from './errors';

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

describe('recordYear', () => {
  /** The bug this replaces: MusicBrainz runs first, so a bare page used to erase its answer. */
  it('does not let a later source erase what an earlier one found', () => {
    const album = {errors: []};
    recordYear(album, MetaSource.MUSICBRAINZ, true);
    recordYear(album, MetaSource.WIKIPEDIA, false);
    expect(album.errors).toEqual([]);
    expect(album.metaSources.year).toEqual([MetaSource.MUSICBRAINZ]);
  });

  it('flags the year once every source that reported came up empty', () => {
    const album = {errors: []};
    recordYear(album, MetaSource.MUSICBRAINZ, false);
    expect(album.errors).toEqual([ExtensionError.YEAR]);
  });

  it('brings the error back when the source that had it stops finding it', () => {
    const album = {errors: []};
    recordYear(album, MetaSource.MUSICBRAINZ, true);
    recordYear(album, MetaSource.MUSICBRAINZ, false);
    expect(album.errors).toEqual([ExtensionError.YEAR]);
  });

  it('records a source once however often it reports', () => {
    const album = {errors: []};
    recordYear(album, MetaSource.WIKIPEDIA, true);
    recordYear(album, MetaSource.WIKIPEDIA, true);
    expect(album.metaSources.year).toEqual([MetaSource.WIKIPEDIA]);
  });
});

describe('recordGenres', () => {
  /**
   * The genres of an album are the union of what the sources say, not whichever spoke last.
   * The run order is fixed (MusicBrainz, then Wikipedia), so replacing meant Wikipedia always
   * won — including when its infobox had no genre row.
   */
  it('unions the two sources rather than replacing', () => {
    const album = {errors: []};
    recordGenres(album, MetaSource.MUSICBRAINZ, ['Alternative Rock', 'Shoegaze']);
    const union = recordGenres(album, MetaSource.WIKIPEDIA, ['Dream Pop', 'Shoegaze']);
    expect(union).toEqual(['Alternative Rock', 'Shoegaze', 'Dream Pop']);
    expect(album.errors).toEqual([]);
  });

  it('keeps the union stable whichever order the sources report in', () => {
    const one = {errors: []};
    recordGenres(one, MetaSource.WIKIPEDIA, ['Dream Pop']);
    const first = recordGenres(one, MetaSource.MUSICBRAINZ, ['Shoegaze']);
    const two = {errors: []};
    recordGenres(two, MetaSource.MUSICBRAINZ, ['Shoegaze']);
    const second = recordGenres(two, MetaSource.WIKIPEDIA, ['Dream Pop']);
    expect(first).toEqual(second);
  });

  it('lets a source withdraw its own genres without touching the other', () => {
    const album = {errors: []};
    recordGenres(album, MetaSource.MUSICBRAINZ, ['Shoegaze']);
    recordGenres(album, MetaSource.WIKIPEDIA, ['Dream Pop']);
    expect(recordGenres(album, MetaSource.WIKIPEDIA, [])).toEqual(['Shoegaze']);
    expect(album.errors).toEqual([]);
  });

  it('flags the album once no source has any', () => {
    const album = {errors: []};
    recordGenres(album, MetaSource.MUSICBRAINZ, []);
    expect(album.errors).toEqual([ExtensionError.GENRE]);
    recordGenres(album, MetaSource.WIKIPEDIA, ['Shoegaze']);
    expect(album.errors).toEqual([]);
  });

  /** This library holds five pairs of acronyms differing only in case ("R&B" / "R&b"). */
  it('does not keep two spellings of the same genre', () => {
    const album = {errors: []};
    recordGenres(album, MetaSource.MUSICBRAINZ, ['R&B']);
    expect(recordGenres(album, MetaSource.WIKIPEDIA, ['R&b', 'Soul'])).toEqual(['R&B', 'Soul']);
  });
});

describe('unionGenres', () => {
  it('is empty when nothing has reported', () => {
    expect(unionGenres(undefined)).toEqual([]);
    expect(unionGenres({})).toEqual([]);
  });

  it('drops blank names', () => {
    expect(unionGenres({musicbrainz: ['', '  ', 'Jazz']})).toEqual(['Jazz']);
  });
});

describe('withSourceErrors', () => {
  it('re-derives a stale genre flag from the stored provenance', () => {
    // 57 of the 82 albums flagged "No genres found" in this library have genres
    expect(withSourceErrors([ExtensionError.GENRE], {genres: {musicbrainz: ['Rock']}}))
      .toEqual([]);
  });

  it('adds the flag when every source that reported came up empty', () => {
    expect(withSourceErrors([], {genres: {musicbrainz: [], wikipedia: []}}))
      .toEqual([ExtensionError.GENRE]);
    expect(withSourceErrors([], {year: []})).toEqual([ExtensionError.YEAR]);
  });

  /** Before the first run there is no provenance, so the stored flag is left exactly as it is. */
  it('says nothing about a field no source has reported on', () => {
    expect(withSourceErrors([ExtensionError.GENRE], undefined)).toEqual([ExtensionError.GENRE]);
    expect(withSourceErrors([ExtensionError.GENRE], {year: ['wikipedia']}))
      .toEqual([ExtensionError.GENRE]);
  });

  it('leaves unrelated errors alone', () => {
    expect(withSourceErrors([ExtensionError.NO_MATCH], {genres: {wikipedia: ['Rock']}}))
      .toEqual([ExtensionError.NO_MATCH]);
  });
});
