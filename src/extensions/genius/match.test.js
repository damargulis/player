import {findMatch} from './match';

/**
 * Every case here is a real pair taken from probing Genius with tracks this extension had
 * failed to link — the matcher was exact string equality and was throwing away the correct
 * first hit over a comma. The negative cases matter at least as much: loosening a matcher
 * risks linking the wrong song, which is worse than linking nothing.
 */
const hit = (title, artist) => ({artist, id: `${title}|${artist}`, title});
const found = (hits, title, artist) => {
  const match = findMatch(hits, title, artist);
  return match && match.title;
};

describe('findMatch accepts what Genius actually returns', () => {
  it('matches an exact pair, as it always did', () => {
    expect(found([hit('Dolly Dagger', 'Jimi Hendrix')], 'Dolly Dagger', 'Jimi Hendrix'))
      .toEqual('Dolly Dagger');
  });

  it('ignores a comma Genius adds', () => {
    expect(found([hit('Paint It, Black', 'The Rolling Stones')],
      'Paint It Black', 'The Rolling Stones')).toEqual('Paint It, Black');
    expect(found([hit('Another Brick in the Wall, Pt. 3', 'Pink Floyd')],
      'Another Brick In The Wall Pt. 3', 'Pink Floyd')).toBeTruthy();
  });

  /** The spaced key reads "3 a m" and "3 am" as different; the tight key is why this works. */
  it('ignores periods inside an abbreviation', () => {
    expect(found([hit('3 AM', 'Matchbox Twenty')], '3 A.M.', 'Matchbox Twenty')).toEqual('3 AM');
  });

  it('ignores an apostrophe the library simply lacks', () => {
    expect(found([hit('Gods’ Dice', 'Pearl Jam')], 'Gods Dice', 'Pearl Jam')).toBeTruthy();
    expect(found([hit('I’m Losin’ It', '2Pac')], "I'm Losin It", '2Pac')).toBeTruthy();
  });

  it('folds accents', () => {
    expect(found([hit('Déjà Vu', 'Yeah Yeah Yeahs')], 'Deja Vu', 'Yeah Yeah Yeahs')).toBeTruthy();
  });

  it('reads & and "and" as the same word', () => {
    expect(found([hit('Sage and Spirit', 'The Grateful Dead')], 'Sage & Spirit', 'Grateful Dead'))
      .toBeTruthy();
    expect(found([hit('40 Day Dream', 'Edward Sharpe & The Magnetic Zeros')],
      '40 Day Dream', 'Edward Sharpe and the Magnetic Zeros')).toBeTruthy();
  });

  it('treats a leading "the" as optional on either side', () => {
    expect(found([hit('The Spirit of Radio', 'Rush')], 'Spirit Of Radio', 'Rush')).toBeTruthy();
    expect(found([hit('Mystery Achievement', 'Pretenders')],
      'Mystery Achievement', 'The Pretenders')).toBeTruthy();
  });

  it('ignores where the word break falls in a name', () => {
    expect(found([hit('Elevator', 'Box Car Racer')], 'Elevator', 'Boxcar Racer')).toBeTruthy();
    expect(found([hit('Not Alone Anymore', 'Traveling Wilburys')],
      'Not Alone Any More', 'Traveling Wilburys')).toBeTruthy();
  });

  it('allows a trailing qualifier on the Genius side', () => {
    expect(found([hit('U Can Call (Original Version)', '2Pac')], 'U Can Call', '2Pac'))
      .toBeTruthy();
  });

  it('allows a trailing qualifier on the library side', () => {
    expect(found([hit('Isn’t It a Pity', 'George Harrison')],
      'Isn\'t it a Pity (Version One)', 'George Harrison')).toBeTruthy();
  });

  it('allows one side to carry a backing band', () => {
    expect(found([hit('Night Rally', 'Elvis Costello')],
      'Night Rally', 'Elvis Costello and The Attractions')).toBeTruthy();
  });

  /** Genius lists live and demo cuts beside the album track; the plain title is what was asked for. */
  it('prefers an exact title over a qualifier-stripped one, whatever the order', () => {
    const hits = [hit('Dolly Dagger [Rainbow Bridge]', 'Jimi Hendrix'),
      hit('Dolly Dagger', 'Jimi Hendrix')];
    expect(found(hits, 'Dolly Dagger', 'Jimi Hendrix')).toEqual('Dolly Dagger');
  });
});

describe('findMatch refuses what it should', () => {
  it('rejects a cover by a different artist', () => {
    // the real first-page result for this search, and the reason the artist is checked at all
    expect(found([hit('Paint It Black (The Rolling Stones cover)', 'Witchfynde')],
      'Paint It Black', 'The Rolling Stones')).toBeUndefined();
  });

  it('rejects the translation accounts that crowd the results', () => {
    expect(found([hit('blink-182 - Roller Coaster (Traducción al Español)',
      'Genius Traducciones al Español')], 'Roller Coaster', 'Blink-182')).toBeUndefined();
  });

  it('rejects a genuinely different title', () => {
    expect(found([hit('Am I What I Was or Was I What I Am', 'Traffic')],
      'Am I What I Was or Am I What I Am', 'Traffic')).toBeUndefined();
    expect(found([hit('Goners', 'Matt Fed')], 'Ginders', 'Matt & Kim')).toBeUndefined();
  });

  it('rejects a bracketed prefix rather than treating it as a qualifier', () => {
    // only a *trailing* bracket is a qualifier; "La Turba (Night Rally)" is another song
    expect(found([hit('La Turba (Night Rally)', 'Elvis Costello')],
      'Night Rally', 'Elvis Costello and The Attractions')).toBeUndefined();
  });

  it('will not let a very short name swallow a longer one', () => {
    expect(found([hit('Stan', 'Em')], 'Stan', 'Eminem')).toBeUndefined();
    expect(found([hit('Alive', 'Pearl')], 'Alive', 'Pearl Jam')).toBeUndefined();
  });

  it('returns nothing when there are no hits', () => {
    expect(findMatch([], 'Snap Your Fingers', 'Jet')).toBeUndefined();
  });
});
