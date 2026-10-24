import {artistsByMbid, budgetRemaining, isStale, matchConcerts} from './store';
import {emptyCache, milesBetween, MONTHLY_CALL_BUDGET} from './types';

function ev(id, date, mbids, venue = 'Venue') {
  return {concert: {id, date, name: 'Show', venue, city: 'New York', region: 'NY'}, mbids};
}

const artists = [
  {id: 'ar1', name: 'Mac DeMarco', mbid: 'AAAA-1111'},
  {id: 'ar2', name: 'Pixies', mbid: 'bbbb-2222'},
  {id: 'ar3', name: 'Unknown To JamBase', mbid: undefined},
];

test('artists are keyed by lowercased musicbrainz id', () => {
  expect(artistsByMbid(artists)).toStrictEqual({'aaaa-1111': 'ar1', 'bbbb-2222': 'ar2'});
});

test('only shows featuring a library artist are kept', () => {
  const matched = matchConcerts(
    [ev('e1', '2026-11-01', ['aaaa-1111']), ev('e2', '2026-11-02', ['zzzz-9999'])],
    artistsByMbid(artists),
  );
  expect(matched.map((c) => c.id)).toStrictEqual(['e1']);
  expect(matched[0].artistIds).toStrictEqual(['ar1']);
});

test('matching is case-insensitive on the musicbrainz id', () => {
  const matched = matchConcerts([ev('e1', '2026-11-01', ['AAAA-1111'])], artistsByMbid(artists));
  expect(matched).toHaveLength(1);
});

test('a bill with several of my artists collapses to one show', () => {
  const matched = matchConcerts(
    [ev('e1', '2026-11-01', ['aaaa-1111', 'bbbb-2222', 'zzzz-9999'])],
    artistsByMbid(artists),
  );
  expect(matched).toHaveLength(1);
  expect(matched[0].artistIds.sort()).toStrictEqual(['ar1', 'ar2']);
});

test('the same event arriving twice merges rather than duplicating', () => {
  const matched = matchConcerts(
    [ev('e1', '2026-11-01', ['aaaa-1111']), ev('e1', '2026-11-01', ['bbbb-2222'])],
    artistsByMbid(artists),
  );
  expect(matched).toHaveLength(1);
  expect(matched[0].artistIds.sort()).toStrictEqual(['ar1', 'ar2']);
});

test('shows come back in date order', () => {
  const matched = matchConcerts(
    [ev('e2', '2026-12-05', ['aaaa-1111']), ev('e1', '2026-11-01', ['bbbb-2222'])],
    artistsByMbid(artists),
  );
  expect(matched.map((c) => c.id)).toStrictEqual(['e1', 'e2']);
});

test('a fresh cache is stale, and budget starts whole', () => {
  const cache = emptyCache();
  expect(isStale(cache)).toBe(true);
  expect(budgetRemaining(cache)).toBe(MONTHLY_CALL_BUDGET);
  cache.fetchedAt = Date.now();
  expect(isStale(cache)).toBe(false);
});

test('budget counts calls made this month only', () => {
  const cache = emptyCache();
  cache.usage.calls = 940;
  expect(budgetRemaining(cache)).toBe(MONTHLY_CALL_BUDGET - 940);
  cache.usage.month = '1999-01';
  expect(budgetRemaining(cache)).toBe(MONTHLY_CALL_BUDGET);
});

test('distance is roughly right', () => {
  // Manhattan to Brooklyn is a few miles; NYC to Chicago about 710
  expect(Math.round(milesBetween(40.7128, -74.006, 40.6782, -73.9442))).toBeLessThan(10);
  expect(Math.round(milesBetween(40.7128, -74.006, 41.8781, -87.6298))).toBeGreaterThan(690);
});
