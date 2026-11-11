import {MetaSource, MetaSources, recordGenres} from './errors';
import {getGenreIds} from '../redux/selectors';
import {RootState} from '../redux/store';

/** Albums and artists both carry genres, and both are updated by the same rule. */
interface Genred {
  errors: string[];
  genreIds: string[];
  metaSources?: MetaSources;
}

/**
 * Applies one source's genres, leaving the entity holding the **union** of every source's.
 *
 * The single definition of that rule on purpose: four writers (MusicBrainz and Wikipedia, for
 * albums and for artists) used to each assign `genreIds` outright, so the genres an album ended
 * up with were whichever extension ran last — and the order is fixed, so Wikipedia always won,
 * including when its infobox had no genre row at all.
 *
 * The union is also what drops a genre that came in from the iTunes import: once a source has
 * supplied any, the entity's genres become exactly what the sources say, so an imported "Rock"
 * that none of them mentions goes away.
 *
 * It only does that when there is something to put in its place. An album whose sources both
 * came up empty keeps what the import gave it, because a coarse genre is more use than none
 * and the `GENRE` error already says no source could confirm it. That also matters mid-run: a
 * Run All does MusicBrainz then Wikipedia, and wiping on the first step would leave an album
 * genreless whenever the second one threw — which it does on the 103 albums here whose
 * Wikipedia page will not parse.
 */
export function applyGenres(store: RootState, item: Genred, source: MetaSource, found: string[]): void {
  const union = recordGenres(item, source, found);
  if (union.length) {
    item.genreIds = getGenreIds(store, union);
  }
}
