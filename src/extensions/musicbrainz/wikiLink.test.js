import {getWikiPageUrl} from './api';

/**
 * The Wikipedia extension finds pages by guessing urls — four for an artist, ten for an album,
 * built by slugging the name. That is why artist coverage sat at 66% while 90% of artists had
 * a MusicBrainz id all along: MusicBrainz knows the page, and the artist lookup was already
 * asking for `url-rels` and throwing the answer away.
 *
 * Only the relation-picking is tested here; following a Wikidata entity to its enwiki sitelink
 * needs the network, and was verified live instead — 8 of 12 sampled artists resolved and all
 * 8 were real pages, including Jhené Aiko and Zoë Kravitz, which url-guessing handles badly.
 */
const rel = (type, resource) => ({type, url: {resource}});

describe('getWikiPageUrl', () => {
  it('uses a direct wikipedia relation without touching Wikidata', async () => {
    const url = await getWikiPageUrl([rel('wikipedia', 'https://en.wikipedia.org/wiki/Radiohead')]);
    expect(url).toEqual('https://en.wikipedia.org/wiki/Radiohead');
  });

  it('prefers the direct relation over a wikidata one', async () => {
    const url = await getWikiPageUrl([
      rel('wikidata', 'https://www.wikidata.org/wiki/Q11649'),
      rel('wikipedia', 'https://en.wikipedia.org/wiki/Radiohead'),
    ]);
    expect(url).toEqual('https://en.wikipedia.org/wiki/Radiohead');
  });

  it('resolves to nothing when there is no usable relation', async () => {
    expect(await getWikiPageUrl([])).toBeUndefined();
    expect(await getWikiPageUrl(undefined)).toBeUndefined();
    expect(await getWikiPageUrl([rel('discogs', 'https://www.discogs.com/artist/3840')]))
      .toBeUndefined();
  });

  it('ignores a relation with no url rather than throwing', async () => {
    expect(await getWikiPageUrl([{type: 'wikipedia'}, {type: 'wikidata'}])).toBeUndefined();
  });
});
