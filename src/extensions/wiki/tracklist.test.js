const {getTracklists} = require('./tracklist');
const {getDoc} = require('./utils');
const closerToTheSun = require('./test_pages/closer_to_the_sun');
const franzFerdinand = require('./test_pages/franz_ferdinand');
const jacksonBrowne = require('./test_pages/jackson_browne');
const mrMorale = require('./test_pages/mr_morale');
const numberOneRecord = require('./test_pages/number_one_record');
const radiohead = require('./test_pages/radiohead');
const thirdEyeBlind = require('./test_pages/third_eye_blind');
const unknownPleasures = require('./test_pages/unknown_pleasures');
const wilco = require('./test_pages/wilco');

/**
 * Every fixture here is a real page as Wikipedia serves it now, saved 2026-11-11.
 *
 * That matters more than usual. The previous parser walked `nextElementSibling` from the
 * "Track listing" heading, which Parsoid now wraps in a `div.mw-heading` inside a `<section>`,
 * so it found the edit-section span and nothing else — measured against 60 live pages sampled
 * across this library it returned tracks for **0 of them**, and the suite passed throughout
 * because all five saved fixtures predated the change. Refreshing them is half the fix.
 */

function parse(fixture) {
  return getTracklists(getDoc(fixture.doc), fixture.album);
}

function names(tracks) {
  return tracks.map((track) => track.name);
}

describe('the tracklist template', () => {
  it('reads a plain single-table album', () => {
    const parsed = parse(numberOneRecord);
    expect(parsed.readable).toBe(true);
    expect(names(parsed.main)).toStrictEqual(['Feel', 'The Ballad of El Goodo', 'In the Street',
      'Thirteen', "Don't Lie to Me", 'The India Song', "When My Baby's Beside Me",
      'My Life Is Right', 'Give Me Another Chance', 'Try Again', 'Watch the Sunrise', 'ST 100/6']);
    expect(parsed.alternate).toStrictEqual([]);
  });

  /** The regression itself: this page is in the markup the old parser could not read at all. */
  it('reads a page in the current markup', () => {
    expect(parse(unknownPleasures).readable).toBe(true);
  });

  it('keeps the sides of an album together and the bonus disc apart', () => {
    const parsed = parse(unknownPleasures);
    // "Side one (Outside)" and "Side two (Inside)"
    expect(names(parsed.main)).toStrictEqual(['Disorder', 'Day of the Lords', 'Candidate',
      'Insight', 'New Dawn Fades', "She's Lost Control", 'Shadowplay', 'Wilderness', 'Interzone',
      'I Remember Nothing']);
    // the 2007 remaster's live disc, which repeats most of the album
    expect(parsed.alternate).toHaveLength(12);
  });

  it('keeps both discs of a double album as the album', () => {
    const parsed = parse(mrMorale);
    // "Disc 1: Big Steppers" and "Disc 2: Mr. Morale", then a digital bonus track
    expect(parsed.main).toHaveLength(18);
    expect(names(parsed.main)[0]).toBe('United in Grief');
    expect(names(parsed.main)[9]).toBe('Count Me Out');
    expect(names(parsed.alternate)).toStrictEqual(['The Heart Part 5']);
  });

  it('does not count a bonus track as part of the album', () => {
    const parsed = parse(wilco);
    expect(parsed.main).toHaveLength(11);
    expect(names(parsed.alternate)).toStrictEqual(['Dark Neon']);
  });

  /**
   * "Franz Ferdinand (standard edition)" is the album; "(limited edition bonus disc)" is not.
   * Both captions say "edition", so "standard" has to be read before the edition words.
   */
  it('reads the standard edition as the album', () => {
    const parsed = parse(franzFerdinand);
    expect(names(parsed.main)).toStrictEqual(['Jacqueline', 'Tell Her Tonight', 'Take Me Out',
      'The Dark of the Matinée', 'Auf Achse', 'Cheating on You', 'This Fire', 'Darts of Pleasure',
      'Michael', 'Come on Home', "40'"]);
    expect(parsed.alternate).toHaveLength(15);
  });

  /**
   * This caption carries TemplateStyles, exactly as the genre cell does: its raw text begins
   * "Third Eye Blind .mw-parser-output .nobold{font-weight:normal}". Read that way it matches
   * none of the caption rules and the album's own tracklist is filed as an edition.
   */
  it('reads a caption with a stylesheet inside it', () => {
    const parsed = parse(thirdEyeBlind);
    expect(parsed.main).toHaveLength(14);
    expect(names(parsed.main)[0]).toBe('Losing a Whole Year');
  });

  it('takes featured artists off the title cell', () => {
    const featured = parse(mrMorale).main.filter((track) => track.featuring.length);
    expect(featured.map((track) => [track.name, track.featuring])).toStrictEqual([
      ['Father Time', ['Sampha']],
      ['Mother I Sober', ['Beth Gibbons']],
    ]);
  });
});

describe('the older list form', () => {
  it('reads a single ordered list', () => {
    const parsed = parse(closerToTheSun);
    expect(parsed.readable).toBe(true);
    expect(parsed.main).toHaveLength(20);
    expect(names(parsed.main)[0]).toBe('Intro');
    expect(names(parsed.main)[19]).toBe('Open Road');
    expect(parsed.alternate).toStrictEqual([]);
  });

  it('reads featured artists out of a list item', () => {
    const featured = parse(closerToTheSun).main.filter((track) => track.featuring.length);
    expect(featured.map((track) => track.featuring)).toStrictEqual([
      ['Barrington Levy', 'Mr. Mutton'],
      ['Billy', 'Prof Most'],
    ]);
  });

  /**
   * The list this page introduces with "All tracks are written by Jackson Browne." — prose, not
   * a label. Treating any short line before a list as a label named no edition, fell through to
   * the unrecognised case, and filed the whole album as a bonus list. That default is right for
   * a caption and wrong for a paragraph.
   */
  it('does not read introductory prose as an edition heading', () => {
    const parsed = parse(jacksonBrowne);
    expect(parsed.readable).toBe(true);
    expect(names(parsed.main)).toStrictEqual(['Jamaica Say You Will', 'A Child in These Hills',
      'Song for Adam', 'Doctor, My Eyes', 'From Silver Lake', 'Something Fine',
      'Under the Falling Sky', 'Looking into You', 'Rock Me on the Water', 'My Opening Farewell']);
    expect(parsed.alternate).toStrictEqual([]);
  });
});

describe('when there is no tracklist', () => {
  /**
   * `readable: false` is the whole point of the flag. An unreadable page used to fall through to
   * "wrong number of tracks", which is a different claim and was being made about every album
   * with a Wikipedia page.
   */
  it('says so rather than reporting an empty tracklist', () => {
    const parsed = getTracklists(getDoc(radiohead.doc), 'Radiohead');
    expect(parsed.readable).toBe(false);
    expect(parsed.main).toStrictEqual([]);
  });
});
