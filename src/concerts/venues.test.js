import {groupByVenue} from './venues';

function show(id, date, venue, lat, lon) {
  return {id, date, name: 'Show', venue, city: 'New York', region: 'NY', lat, lon, artistIds: []};
}

describe('groupByVenue', () => {
  it('puts every show at the same place on one pin, keeping their order', () => {
    const {venues, unplaced} = groupByVenue([
      show('a', '2027-01-02', 'Brooklyn Steel', 40.71155, -73.94042),
      show('b', '2027-01-05', 'Bowery Ballroom', 40.72036, -73.99375),
      show('c', '2027-01-09', 'Brooklyn Steel - NY', 40.71155, -73.94042),
    ]);
    expect(unplaced).toBe(0);
    expect(venues.map((v) => v.concerts.map((c) => c.id))).toEqual([['a', 'c'], ['b']]);
    expect(venues[0].name).toBe('Brooklyn Steel');
  });

  it('counts shows with no location instead of placing them at 0,0', () => {
    const {venues, unplaced} = groupByVenue([
      show('a', '2027-01-02', 'Somewhere', undefined, undefined),
      show('b', '2027-01-03', 'Bad', NaN, -73.9),
      show('c', '2027-01-04', 'Bowery Ballroom', 40.72036, -73.99375),
    ]);
    expect(unplaced).toBe(2);
    expect(venues.map((v) => v.key)).toEqual(['40.7204,-73.9938']);
  });

  it('keeps venues a block apart as separate pins', () => {
    const {venues} = groupByVenue([
      show('a', '2027-01-02', 'One', 40.7200, -73.9900),
      show('b', '2027-01-02', 'Two', 40.7210, -73.9900),
    ]);
    expect(venues).toHaveLength(2);
  });
});
