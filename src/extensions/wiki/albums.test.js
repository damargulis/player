
const albums = require('./albums');
const {getDoc} = require('./utils');
const closerToTheSun = require('./test_pages/closer_to_the_sun');
const numberOneRecord = require('./test_pages/number_one_record');
const jacksonBrowne = require('./test_pages/jackson_browne');

/**
 * Test basic, unformatted tracklist.
 * Looks like
 *
 * Track Listing
 * ___________
 *   1. Track 1
 *   2. Track 2
 */
test('testing unformatted list', () => {
  const doc = getDoc(closerToTheSun.doc);
  expect(albums.getTracks(doc)).toStrictEqual(closerToTheSun.tracklist);
});

test('testing multi side unformatted list', () => {
  const doc = getDoc(jacksonBrowne.doc);
  expect(albums.getTracks(doc)).toStrictEqual(jacksonBrowne.tracklist);
});

/**
 * Test basic table.
 * Looks like
 *
 * No.   Title    Lead Vocals   Length
 *  1    First    Person        4:03
 */
test('testing basic table structure', () => {
  const doc = getDoc(numberOneRecord.doc);
  expect(albums.getTracks(doc)).toStrictEqual(numberOneRecord.tracklist);
});
