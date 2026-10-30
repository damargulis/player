import {artistsByMbid, budgetRemaining, concertsForArtists, findUnseen, isStale, matchConcerts, isUpcoming, REFRESH_INTERVAL_MS, saveCache, upcomingConcerts} from './store';
import {DEFAULT_LOCATION, emptyCache, milesBetween, MONTHLY_CALL_BUDGET} from './types';

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

test('a daily sweep of a dense metro stays inside the monthly budget', () => {
  // a 25-mile NYC sweep is about 24 pages; daily must fit in 1000 calls a month
  const pagesPerSweep = 24;
  const sweepsPerMonth = Math.floor((30 * 24 * 60 * 60 * 1000) / REFRESH_INTERVAL_MS);
  expect(pagesPerSweep * sweepsPerMonth).toBeLessThan(MONTHLY_CALL_BUDGET);
});

test('the default radius reaches the venues that matter from the upper east side', () => {
  const {lat, lon, radiusMiles} = DEFAULT_LOCATION;
  const venues = {
    'Barclays Center': [40.6826, -73.9754],
    'Coney Island': [40.5745, -73.979],
    'Hoboken': [40.744, -74.0324],
    'Jersey City': [40.7282, -74.0776],
    'MetLife Stadium': [40.8135, -74.0745],
    'Prudential Center': [40.7336, -74.1711],
  };
  Object.keys(venues).forEach((name) => {
    const [vlat, vlon] = venues[name];
    expect([name, milesBetween(lat, lon, vlat, vlon) <= radiusMiles]).toStrictEqual([name, true]);
  });
});


describe('findUnseen', () => {
  function cache(fetched, concerts, unseen = []) {
    return Object.assign(emptyCache(), {
      concerts: concerts.map((id) => ({id, date: '2026-11-01', artistIds: ['ar1']})),
      fetchedAt: fetched,
      unseen,
    });
  }
  function shows(...ids) {
    return ids.map((id) => ({id, date: '2026-11-01', artistIds: ['ar1']}));
  }

  it('flags nothing on the very first sweep', () => {
    // everything is technically new then, so marking it all would just be noise
    expect(findUnseen(emptyCache(), shows('a', 'b'))).toStrictEqual([]);
  });

  it('flags only shows that were not there before', () => {
    expect(findUnseen(cache(1000, ['a']), shows('a', 'b'))).toStrictEqual(['b']);
  });

  it('carries forward shows still unseen from an earlier refresh', () => {
    // two refreshes with no visit in between must not lose the first batch
    const previous = cache(1000, ['a', 'b'], ['b']);
    expect(findUnseen(previous, shows('a', 'b', 'c')).sort()).toStrictEqual(['b', 'c']);
  });

  it('drops carried shows once they fall out of the window', () => {
    const previous = cache(1000, ['a', 'b'], ['b']);
    expect(findUnseen(previous, shows('a'))).toStrictEqual([]);
  });

  it('does not flag a show twice', () => {
    const previous = cache(1000, [], ['a']);
    expect(findUnseen(previous, shows('a'))).toStrictEqual(['a']);
  });
});

describe('concertsForArtists', () => {
  function show(id, date, artistIds, venue = 'Bowery Ballroom') {
    return {artistIds, city: 'New York', date, id, name: 'Show', region: 'NY', venue};
  }

  function dayOffset(days) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-` +
      `${String(date.getDate()).padStart(2, '0')}`;
  }

  function seed(concerts) {
    // saveCache is the only writer, so it is also what drops the memoised index
    saveCache(Object.assign(emptyCache(), {concerts}));
  }

  it('returns an artist\'s upcoming shows', () => {
    seed([show('e1', dayOffset(5), ['ar1'])]);
    expect(concertsForArtists(['ar1']).map((c) => c.id)).toStrictEqual(['e1']);
  });

  it('is empty for an artist with nothing coming up', () => {
    seed([show('e1', dayOffset(5), ['ar1'])]);
    expect(concertsForArtists(['ar2'])).toStrictEqual([]);
  });

  it('orders soonest first, so the badge names the next show', () => {
    seed([show('e2', dayOffset(20), ['ar1']), show('e1', dayOffset(3), ['ar1'])]);
    expect(concertsForArtists(['ar1']).map((c) => c.id)).toStrictEqual(['e1', 'e2']);
  });

  // A track crediting both halves of a collaboration must not badge the same gig twice.
  it('de-duplicates a show shared by two credited artists', () => {
    seed([show('e1', dayOffset(5), ['ar1', 'ar2'])]);
    expect(concertsForArtists(['ar1', 'ar2']).map((c) => c.id)).toStrictEqual(['e1']);
  });

  it('merges shows across the artists on one track', () => {
    seed([show('e1', dayOffset(3), ['ar1']), show('e2', dayOffset(9), ['ar2'])]);
    expect(concertsForArtists(['ar1', 'ar2']).map((c) => c.id)).toStrictEqual(['e1', 'e2']);
  });

  // The cache is only refreshed daily, so without a date filter a stale one would keep
  // badging a gig that has already happened.
  it('ignores shows that have already happened', () => {
    seed([show('past', dayOffset(-2), ['ar1']), show('soon', dayOffset(2), ['ar1'])]);
    expect(concertsForArtists(['ar1']).map((c) => c.id)).toStrictEqual(['soon']);
  });

  it('still counts a show later today', () => {
    seed([show('tonight', dayOffset(0), ['ar1'])]);
    expect(concertsForArtists(['ar1']).map((c) => c.id)).toStrictEqual(['tonight']);
  });

  it('is empty when nothing is cached at all', () => {
    seed([]);
    expect(concertsForArtists(['ar1'])).toStrictEqual([]);
  });
});

describe('isUpcoming', () => {
  function show(date) {
    return {artistIds: ['ar1'], city: 'New York', date, id: 'e1', name: 'Show', region: 'NY',
      venue: 'Venue'};
  }
  const now = new Date('2026-10-30T15:00:00');

  // The reported bug: on Oct 30 the artist page still listed an Oct 27 gig, and the DJ called
  // it upcoming. Three separate copies of this check existed and only one filtered by date.
  it('excludes a show from earlier in the week', () => {
    expect(isUpcoming(show('2026-10-27'), now)).toBe(false);
  });

  it('excludes yesterday', () => {
    expect(isUpcoming(show('2026-10-29'), now)).toBe(false);
  });

  // Midnight, not "now": a gig tonight has not happened yet even at 3pm.
  it('includes a show later today', () => {
    expect(isUpcoming(show('2026-10-30'), now)).toBe(true);
  });

  it('includes future shows', () => {
    expect(isUpcoming(show('2026-11-19'), now)).toBe(true);
  });

  // localDate, not new Date(iso): a date-only value is UTC midnight and lands a day early west
  // of Greenwich, which would drop a show that is actually today.
  it('reads a date-only value as local, not UTC', () => {
    expect(isUpcoming(show('2026-10-30'), new Date('2026-10-30T00:30:00'))).toBe(true);
  });
});

describe('upcomingConcerts', () => {
  it('drops past shows and orders the rest soonest first', () => {
    const cache = Object.assign(emptyCache(), {concerts: [
      {artistIds: ['ar1'], city: 'NY', date: '2099-01-02', id: 'later', name: 'S', region: 'NY', venue: 'V'},
      {artistIds: ['ar1'], city: 'NY', date: '2000-01-01', id: 'past', name: 'S', region: 'NY', venue: 'V'},
      {artistIds: ['ar1'], city: 'NY', date: '2099-01-01', id: 'soon', name: 'S', region: 'NY', venue: 'V'},
    ]});
    expect(upcomingConcerts(cache).map((c) => c.id)).toStrictEqual(['soon', 'later']);
  });
});
