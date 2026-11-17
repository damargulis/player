import {
  fetchWithRetry,
  getArtistImageUrl,
  musicBrainzUrl,
  parseMbid,
  getFeaturedArtists,
  getGenreNames,
  getReleaseTracks,
  matchTracklist,
  pickBestArtist,
  pickBestReleaseGroup,
  pickMatchingRelease,
  TracklistMatch,
} from './api';
import {ExtensionError, migrateLegacyErrors} from '../errors';

const yankeeHotelFoxtrot = {
  'id': 'rg-yhf',
  'score': 100,
  'title': 'Yankee Hotel Foxtrot',
  'primary-type': 'Album',
  'artist-credit': [{name: 'Wilco'}],
};

const yankeeHotelFoxtrotDemos = {
  'id': 'rg-yhf-demos',
  'score': 95,
  'title': 'The Yankee Hotel Foxtrot Demos',
  'primary-type': 'Album',
  'artist-credit': [{name: 'Wilco'}],
};

const yankeeHotelFoxtrotSingle = {
  'id': 'rg-yhf-single',
  'score': 100,
  'title': 'Yankee Hotel Foxtrot',
  'primary-type': 'Single',
  'artist-credit': [{name: 'Wilco'}],
};

test('picks the exact title match over a higher-listed partial match', () => {
  const results = [yankeeHotelFoxtrotDemos, yankeeHotelFoxtrot];
  const match = pickBestReleaseGroup(results, 'Yankee Hotel Foxtrot', ['Wilco']);
  expect(match.id).toBe('rg-yhf');
});

test('prefers a full album over a single with the same title', () => {
  const results = [yankeeHotelFoxtrotSingle, yankeeHotelFoxtrot];
  const match = pickBestReleaseGroup(results, 'Yankee Hotel Foxtrot', ['Wilco']);
  expect(match.id).toBe('rg-yhf');
});

test('ignores same-named albums by other artists', () => {
  const greatestHitsByOther = {
    'id': 'rg-other',
    'score': 100,
    'title': 'Greatest Hits',
    'primary-type': 'Album',
    'artist-credit': [{name: 'Someone Else'}],
  };
  const greatestHits = {
    'id': 'rg-mine',
    'score': 98,
    'title': 'Greatest Hits',
    'primary-type': 'Album',
    'artist-credit': [{name: 'Queen'}],
  };
  const match = pickBestReleaseGroup([greatestHitsByOther, greatestHits], 'Greatest Hits', ['Queen']);
  expect(match.id).toBe('rg-mine');
});

test('collaboration credits match any of the album artists', () => {
  const lottaSeaLice = {
    'id': 'rg-lsl',
    'score': 100,
    'title': 'Lotta Sea Lice',
    'primary-type': 'Album',
    'artist-credit': [{name: 'Courtney Barnett and Kurt Vile'}],
  };
  const decoy = {
    'id': 'rg-lsl-other',
    'score': 100,
    'title': 'Lotta Sea Lice',
    'primary-type': 'Album',
    'artist-credit': [{name: 'Someone Else'}],
  };
  const match = pickBestReleaseGroup([decoy, lottaSeaLice], 'Lotta Sea Lice', ['Courtney Barnett', 'Kurt Vile']);
  expect(match.id).toBe('rg-lsl');
});

test('split collaboration credits match a combined library artist', () => {
  const splitCredits = {
    'id': 'rg-split',
    'score': 100,
    'title': 'Lotta Sea Lice',
    'primary-type': 'Album',
    'artist-credit': [{name: 'Courtney Barnett', joinphrase: ' and '}, {name: 'Kurt Vile'}],
  };
  const match = pickBestReleaseGroup([splitCredits], 'Lotta Sea Lice', ['Courtney Barnett and Kurt Vile']);
  expect(match.id).toBe('rg-split');
});

test('title matching ignores case and punctuation', () => {
  const results = [{
    'id': 'rg-punct',
    'score': 100,
    'title': '(What’s the Story) Morning Glory?',
    'primary-type': 'Album',
    'artist-credit': [{name: 'Oasis'}],
  }];
  const match = pickBestReleaseGroup(results, '(What\'s the Story) Morning Glory?', ['Oasis']);
  expect(match.id).toBe('rg-punct');
});

test('returns undefined when nothing matches the title', () => {
  const match = pickBestReleaseGroup([yankeeHotelFoxtrotDemos], 'Yankee Hotel Foxtrot', ['Wilco']);
  expect(match).toBe(undefined);
});

test('returns undefined for low-score matches', () => {
  const lowScore = {...yankeeHotelFoxtrot, score: 50};
  const match = pickBestReleaseGroup([lowScore], 'Yankee Hotel Foxtrot', ['Wilco']);
  expect(match).toBe(undefined);
});

test('picks the artist with the exact name', () => {
  const results = [
    {id: 'artist-tribute', score: 100, name: 'The Wilco Tribute Band'},
    {id: 'artist-wilco', score: 97, name: 'Wilco'},
  ];
  const match = pickBestArtist(results, 'Wilco');
  expect(match.id).toBe('artist-wilco');
});

test('returns undefined when no artist name matches exactly', () => {
  const results = [{id: 'artist-tribute', score: 100, name: 'The Wilco Tribute Band'}];
  expect(pickBestArtist(results, 'Wilco')).toBe(undefined);
});

test('orders genres by tag count and formats them', () => {
  const genres = [
    {name: 'americana', count: 1},
    {name: 'alternative rock', count: 6},
    {name: 'art rock', count: 2},
    {name: 'untagged', count: 0},
  ];
  expect(getGenreNames(genres)).toStrictEqual(['Alternative Rock', 'Art Rock', 'Americana']);
});

test('handles missing genres', () => {
  expect(getGenreNames(undefined)).toStrictEqual([]);
});

const singleDiscRelease = {
  'id': 'release-single-disc',
  'status': 'Official',
  'date': '2002-04-22',
  'media': [{'track-count': 2, 'tracks': [
    {title: 'Track One', position: 1},
    {title: 'Track Two', position: 2},
  ]}],
};

const doubleDiscRelease = {
  'id': 'release-double-disc',
  'status': 'Official',
  'date': '2003-01-01',
  'media': [
    {'track-count': 2, 'tracks': [
      {title: 'Track One', position: 1},
      {title: 'Track Two', position: 2},
    ]},
    {'track-count': 1, 'tracks': [
      {title: 'Bonus Track', position: 1},
    ]},
  ],
};

const bootlegRelease = {
  'id': 'release-bootleg',
  'status': 'Bootleg',
  'date': '2001-01-01',
  'media': [{'track-count': 2, 'tracks': [
    {title: 'Rough One', position: 1},
    {title: 'Rough Two', position: 2},
  ]}],
};

test('picks the release edition matching the local track count', () => {
  const releases = [singleDiscRelease, doubleDiscRelease];
  expect(pickMatchingRelease(releases, 3).id).toBe('release-double-disc');
  expect(pickMatchingRelease(releases, 2).id).toBe('release-single-disc');
  expect(pickMatchingRelease(releases, 5)).toBe(undefined);
});

test('prefers official releases over bootlegs', () => {
  const match = pickMatchingRelease([bootlegRelease, singleDiscRelease], 2);
  expect(match.id).toBe('release-single-disc');
});

test('flattens tracks across discs in play order', () => {
  const titles = getReleaseTracks(doubleDiscRelease).map((track) => track.title);
  expect(titles).toStrictEqual(['Track One', 'Track Two', 'Bonus Track']);
});

test('normalizes typographic apostrophes in titles and credits', () => {
  const release = {
    id: 'release-curly',
    status: 'Official',
    media: [{'track-count': 1, 'tracks': [{
      'title': 'Don’t Stop Believin’',
      'position': 1,
      'artist-credit': [{name: 'The Artist’s Band'}],
    }]}],
  };
  const tracks = getReleaseTracks(release);
  expect(tracks[0].title).toBe('Don\'t Stop Believin\'');
  expect(tracks[0]['artist-credit'][0].name).toBe('The Artist\'s Band');
});

test('finds featured artists from artist credits', () => {
  const track = {
    'title': 'A Song',
    'position': 1,
    'artist-credit': [
      {name: 'Main Artist', joinphrase: ' feat. '},
      {name: 'Guest One', joinphrase: ' & '},
      {name: 'Guest Two'},
    ],
  };
  expect(getFeaturedArtists(track)).toStrictEqual(['Guest One', 'Guest Two']);
});

test('no featured artists without a feat join phrase', () => {
  const track = {
    'title': 'A Song',
    'position': 1,
    'artist-credit': [{name: 'Band One', joinphrase: ' & '}, {name: 'Band Two'}],
  };
  expect(getFeaturedArtists(track)).toStrictEqual([]);
});

test('uses a direct image relation for artist pictures', () => {
  const lookup = {relations: [
    {type: 'wikidata', url: {resource: 'https://www.wikidata.org/wiki/Q1'}},
    {type: 'image', url: {resource: 'https://example.com/artist.jpg'}},
  ]};
  return getArtistImageUrl(lookup).then((url) => {
    expect(url).toBe('https://example.com/artist.jpg');
  });
});

test('converts commons page urls to direct file urls', () => {
  const lookup = {relations: [
    {type: 'image', url: {resource: 'https://commons.wikimedia.org/wiki/File:Artist Pic.jpg'}},
  ]};
  return getArtistImageUrl(lookup).then((url) => {
    expect(url).toBe('https://commons.wikimedia.org/wiki/Special:FilePath/Artist%20Pic.jpg');
  });
});

test('no artist image without image or wikidata relations', () => {
  return getArtistImageUrl({relations: []}).then((url) => {
    expect(url).toBe(undefined);
  });
});

function releaseWithCount(id, status, date, trackCount) {
  return {
    'id': id,
    'status': status,
    'date': date,
    'media': [{'track-count': trackCount, 'tracks': []}],
  };
}

// An album originally released with 12 tracks (2 of them bonus tracks),
// with a later 19-track anniversary edition and an earlier bootleg.
const albumEditions = [
  releaseWithCount('release-anniversary', 'Official', '2012-04-22', 19),
  releaseWithCount('release-original', 'Official', '2002-04-22', 12),
  releaseWithCount('release-bootleg-early', 'Bootleg', '2001-06-01', 25),
];

test('matches the original edition', () => {
  const match = matchTracklist(albumEditions, 12);
  expect(match.type).toBe(TracklistMatch.ORIGINAL);
  expect(match.release.id).toBe('release-original');
});

test('missing the bonus tracks the album originally shipped with is an error', () => {
  const match = matchTracklist(albumEditions, 10);
  expect(match.type).toBe(TracklistMatch.MISSING_TRACKS);
  expect(match.release).toBe(undefined);
});

test('owning a complete later edition is not an error', () => {
  const match = matchTracklist(albumEditions, 19);
  expect(match.type).toBe(TracklistMatch.OTHER_EDITION);
  expect(match.release.id).toBe('release-anniversary');
});

test('more tracks than the original but no matching edition is an error', () => {
  const match = matchTracklist(albumEditions, 15);
  expect(match.type).toBe(TracklistMatch.NO_MATCH);
  expect(match.release).toBe(undefined);
});

test('bootlegs do not define the original edition', () => {
  const match = matchTracklist(albumEditions, 25);
  // 25 tracks matches only the bootleg, which is not an original edition,
  // but is accepted as an other-edition count match.
  expect(match.type).toBe(TracklistMatch.OTHER_EDITION);
});

test('day-one regional variants both count as the original', () => {
  const editions = [
    releaseWithCount('release-uk', 'Official', '2002-04-22', 10),
    releaseWithCount('release-japan', 'Official', '2002-04-22', 12),
  ];
  expect(matchTracklist(editions, 10).type).toBe(TracklistMatch.ORIGINAL);
  expect(matchTracklist(editions, 12).type).toBe(TracklistMatch.ORIGINAL);
  expect(matchTracklist(editions, 8).type).toBe(TracklistMatch.MISSING_TRACKS);
});

test('migrates legacy prefixed errors to shared errors', () => {
  const errors = [
    'Wikipedia Modifier: No page found.',
    'MusicBrainz Modifier: No match found.',
    'Wikipedia Modifier: No year found.',
    'Some unknown error.',
  ];
  expect(migrateLegacyErrors(errors)).toStrictEqual([
    ExtensionError.NO_MATCH,
    ExtensionError.YEAR,
    'Some unknown error.',
  ]);
});

test('migrates missing errors to an empty list', () => {
  expect(migrateLegacyErrors(undefined)).toStrictEqual([]);
});

test('parses an mbid from a musicbrainz url or bare id', () => {
  const mbid = '95f2ba4b-2dd9-38d1-8158-a416a391489c';
  expect(parseMbid(`https://musicbrainz.org/release-group/${mbid}`)).toBe(mbid);
  expect(parseMbid(`https://musicbrainz.org/artist/${mbid}?tab=releases`)).toBe(mbid);
  expect(parseMbid(mbid)).toBe(mbid);
  expect(parseMbid(`  ${mbid.toUpperCase()}  `)).toBe(mbid);
  expect(parseMbid('not an mbid')).toBe(undefined);
  expect(parseMbid('')).toBe(undefined);
  expect(parseMbid(undefined)).toBe(undefined);
});

test('builds musicbrainz urls only when an mbid exists', () => {
  const mbid = '95f2ba4b-2dd9-38d1-8158-a416a391489c';
  expect(musicBrainzUrl('release-group', mbid)).toBe(`https://musicbrainz.org/release-group/${mbid}`);
  expect(musicBrainzUrl('artist', undefined)).toBe('');
});

test('retries rate-limited requests until they succeed', () => {
  const realFetch = global.fetch;
  let calls = 0;
  global.fetch = () => {
    calls++;
    return Promise.resolve({status: calls < 2 ? 503 : 200, ok: calls >= 2});
  };
  return fetchWithRetry('https://example.com').then((res) => {
    global.fetch = realFetch;
    expect(res.status).toBe(200);
    expect(calls).toBe(2);
  }, (err) => {
    global.fetch = realFetch;
    throw err;
  });
});

test('does not retry not-found responses', () => {
  const realFetch = global.fetch;
  let calls = 0;
  global.fetch = () => {
    calls++;
    return Promise.resolve({status: 404, ok: false});
  };
  return fetchWithRetry('https://example.com').then((res) => {
    global.fetch = realFetch;
    expect(res.status).toBe(404);
    expect(calls).toBe(1);
  }, (err) => {
    global.fetch = realFetch;
    throw err;
  });
});

describe('name matching folds accents', () => {
  const {pickBestArtist} = require('./api');

  /**
   * The bug: `[^a-z0-9]` eats an accented letter rather than its accent, so "Sigur Rós" keyed
   * as `sigurrs`. Symmetric while both sides are accented, but an iTunes library holding the
   * unaccented spelling never matched. 14 artists here carry a non-ASCII letter.
   */
  it('matches an unaccented library name to an accented MusicBrainz one', () => {
    const results = [{id: 'mb1', name: 'Sigur Rós', score: 100}];
    expect(pickBestArtist(results, 'Sigur Ros')).toBeTruthy();
    expect(pickBestArtist(results, 'Sigur Rós')).toBeTruthy();
  });

  it('matches the other way round too', () => {
    expect(pickBestArtist([{id: 'mb1', name: 'Beyonce', score: 100}], 'Beyoncé')).toBeTruthy();
    expect(pickBestArtist([{id: 'mb1', name: 'Blue Oyster Cult', score: 100}], 'Blue Öyster Cult')).toBeTruthy();
  });

  /** Folding must not collapse genuinely different artists into one. */
  it('still refuses a different name', () => {
    expect(pickBestArtist([{id: 'mb1', name: 'Sigur Rós', score: 100}], 'Sugar Ray')).toBeFalsy();
    expect(pickBestArtist([{id: 'mb1', name: 'Pearl', score: 100}], 'Pearl Jam')).toBeFalsy();
  });
});

describe('matching the original, not a live album or a reissue', () => {
  const {pickBestReleaseGroup, unexplainedTypes} = require('./api');
  const rg = (id, extra) => Object.assign({
    'artist-credit': [{name: 'Eagles'}], id, 'primary-type': 'Album', score: 100, title: 'Hotel California',
  }, extra);

  /** The case that started this: a 1992 live album, typed primary "Album", listed first. */
  it('prefers the studio album over a live one with the same title', () => {
    const results = [
      rg('live', {'first-release-date': '1992', 'secondary-types': ['Live']}),
      rg('studio', {'first-release-date': '1976-12-08'}),
    ];
    expect(pickBestReleaseGroup(results, 'Hotel California', ['Eagles']).id).toBe('studio');
  });

  it('prefers the earliest when both are plain studio albums', () => {
    const results = [rg('later', {'first-release-date': '2007'}), rg('first', {'first-release-date': '1976'})];
    expect(pickBestReleaseGroup(results, 'Hotel California', ['Eagles']).id).toBe('first');
  });

  it('prefers an album over a single', () => {
    const results = [rg('single', {'first-release-date': '1976', 'primary-type': 'Single'}), rg('album', {})];
    expect(pickBestReleaseGroup(results, 'Hotel California', ['Eagles']).id).toBe('album');
  });

  /** Unless the album's own name says it is a live record. */
  it('takes a live album when the name asks for one', () => {
    const results = [
      rg('studio', {'first-release-date': '1970', title: 'Live at Leeds'}),
      rg('live', {'first-release-date': '1970', 'secondary-types': ['Live'], title: 'Live at Leeds'}),
    ];
    // both qualify; the live one is not penalised, and with equal dates either is acceptable
    expect(unexplainedTypes(['Live'], 'Live at Leeds')).toEqual([]);
    expect(['studio', 'live']).toContain(pickBestReleaseGroup(results, 'Live at Leeds', ['Eagles']).id);
  });

  it('explains a compilation only by a name that sounds like one', () => {
    expect(unexplainedTypes(['Compilation'], 'Greatest Hits')).toEqual([]);
    expect(unexplainedTypes(['Compilation'], 'Hotel California')).toEqual(['Compilation']);
  });

  it('treats an unknown secondary type as unexplained', () => {
    expect(unexplainedTypes(['Audiobook'], 'Anything')).toEqual(['Audiobook']);
    expect(unexplainedTypes(undefined, 'Anything')).toEqual([]);
  });
});

describe('what a recording says about a track', () => {
  const {recordingUpdate} = require('./api');

  it('takes the year the recording first came out', () => {
    expect(recordingUpdate({'first-release-date': '2000-10-24', 'genres': [], 'id': 'r'}).year).toBe(2000);
    expect(recordingUpdate({'first-release-date': '1976', 'id': 'r'}).year).toBe(1976);
  });

  /** No date means no claim: leave the library's year alone. */
  it('says nothing about the year when MusicBrainz has none', () => {
    expect(recordingUpdate({'first-release-date': '', 'id': 'r'}).year).toBeUndefined();
    expect(recordingUpdate(undefined)).toEqual({genres: []});
  });

  /** Recordings often carry eight or nine; the same top-five-by-votes cut as an album's. */
  it('keeps the five most-voted genres', () => {
    const genres = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((name, i) => ({count: i + 1, name}));
    expect(recordingUpdate({genres, id: 'r'}).genres).toEqual(['G', 'F', 'E', 'D', 'C']);
  });
});
