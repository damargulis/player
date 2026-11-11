import {contentText} from './utils';

/**
 * Reading an album's tracklist off its Wikipedia page.
 *
 * This replaces a walk down `nextElementSibling` from the "Track listing" heading, which found
 * nothing at all. Wikipedia now serves Parsoid HTML, where a heading is wrapped:
 *
 *     <section data-mw-section-id="7"><div class="mw-heading mw-heading2">
 *       <h2 id="Track_listing">Track listing</h2><span class="mw-editsection">…</span>
 *     </div>
 *
 * so the `<h2>`'s only next sibling is the edit-section span, inside the same wrapper, with
 * nothing after it. Measured against 60 live album pages sampled across this library, the old
 * parser returned tracks for **0 of them** — and because an empty parse fell through to "wrong
 * number of tracks", every album with a Wikipedia page was flagged as incomplete. Nothing
 * caught it because all the saved fixtures predate the change.
 *
 * The fix is to stop walking sections. The `{{Track listing}}` template renders as
 * `<table class="tracklist">` with a `<caption>`, a `Title` column and one `th[scope=row]` per
 * track; 58 of those 60 pages have at least one, and the remaining two use the older `<ol>`
 * form, which the fallback here reads. Together: 60 of 60.
 */

export interface TrackInfo {
  name: string;
  featuring: string[];
}

export interface TracklistResult {
  /** The album's own tracklist, in order. */
  main: TrackInfo[];
  /** Tracks that only appear on a reissue, a regional edition or a bonus disc. */
  alternate: TrackInfo[];
  /**
   * False when no tracklist could be read at all.
   *
   * A separate fact from a count that does not line up, and the caller must keep it separate:
   * reporting an unreadable page as "wrong number of tracks" is what made that error useless.
   */
  readable: boolean;
}

/**
 * Captions that mark a table as something other than the album.
 *
 * Taken from what the sampled pages actually say: "Japanese edition bonus track", "iTunes bonus
 * track", "40th Anniversary Edition CD bonus tracks", "Rhino reissue bonus tracks",
 * "Disc 2: Bonus tracks (special, vinyl, and deluxe editions)".
 */
const ALTERNATE = new RegExp('\\b(bonus|deluxe|limited|reissue|anniversary|remaster|remastered'
  + '|expanded|single|vinyl|itunes|digital|tour|japan|japanese|australian|international|promo'
  + '|demo|extended play|dvd|additional|acoustic)\\b', 'i');

/** "Side one", "Disc 1: Big Steppers", "Volume one", "Side 1", "LP one". */
const MAIN_PART = /^(side|disc|cd|volume|vol|part|lp)\b/i;

/**
 * A positive signal that a heading names something other than the album.
 *
 * "Franz Ferdinand (standard edition)" and "Standard CD/LP version" are the album even though
 * both say "edition" or "version", so that is checked first.
 */
function saysAlternate(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || /\bstandard\b/i.test(trimmed)) {
    return false;
  }
  return ALTERNATE.test(trimmed);
}

/**
 * Whether a tracklist table's caption marks it as an edition rather than the album.
 *
 * An unrecognised caption counts as an edition. A caption is always a deliberate label — the
 * template only omits it for the album's own list — so something that names neither a side, a
 * disc nor the album is naming a release this one is not.
 */
function captionIsAlternate(caption: string, albumName: string): boolean {
  const text = caption.trim();
  if (!text) {
    return false;
  }
  if (saysAlternate(text)) {
    return true;
  }
  // the template's default caption is "<album> track listing", and some pages set the headline
  // to the album's name alone
  const bare = text.replace(/\s*\(.*?\)\s*/g, ' ').replace(/track listing$/i, '').trim();
  if (bare.toLowerCase() === albumName.trim().toLowerCase()) {
    return false;
  }
  return !MAIN_PART.test(text) && !/track listing$/i.test(text);
}

function featuredArtists(text: string): string[] {
  const matches = text.match(/\(featuring (?<inner>.*?)\)/);
  const inner = matches && matches.groups ? matches.groups.inner : '';
  return inner.split(/, | and /).filter((part) => part.length > 0);
}

/** Titles are quoted by the template; a few pages use typographic quotes instead. */
function titleOf(text: string): string {
  const matches = text.match(/["“](?<inner>.*?)["”]/);
  return matches && matches.groups ? matches.groups.inner : '';
}

function trackFrom(text: string): TrackInfo | undefined {
  const name = titleOf(text);
  return name ? {featuring: featuredArtists(text), name} : undefined;
}

function tracksFromTable(table: HTMLTableElement): TrackInfo[] {
  const headerCells = table.rows[0] ? [...table.rows[0].cells] : [];
  const titleIndex = headerCells.findIndex((cell) => contentText(cell) === 'Title');
  const tracks = [] as TrackInfo[];
  [...table.rows].forEach((row) => {
    // every track row is numbered with a row header; the column header row has none
    if (!row.querySelector('th[scope="row"]')) {
      return;
    }
    const cells = [...row.cells];
    // by column where the header says so, otherwise the first cell that is not the length
    const cell = (titleIndex >= 0 ? cells[titleIndex] : undefined) ||
      cells.find((candidate) => candidate.tagName === 'TD' &&
        !candidate.className.includes('tracklist-length'));
    const track = trackFrom(contentText(cell));
    if (track) {
      tracks.push(track);
    }
  });
  return tracks;
}

function tracksFromList(list: Element): TrackInfo[] {
  const tracks = [] as TrackInfo[];
  [...list.getElementsByTagName('li')].forEach((item) => {
    const track = trackFrom(contentText(item));
    if (track) {
      tracks.push(track);
    }
  });
  return tracks;
}

/**
 * The album's own tables: the first run of them, stopping at the first alternate edition.
 *
 * Wikipedia lists the original release before any reissue, and taking every non-alternate table
 * on the page sums up a record's whole release history — My Aim Is True came to 95 tracks
 * across a super-deluxe's five CDs. A second caption-less table ends the run too, since the
 * template only omits the caption once and an unlabelled table after that is a bonus disc.
 */
function mainTables(tables: HTMLTableElement[], albumName: string): HTMLTableElement[] {
  const main = [] as HTMLTableElement[];
  let seenUncaptioned = false;
  for (const table of tables) {
    const caption = contentText(table.caption);
    if (captionIsAlternate(caption, albumName)) {
      break;
    }
    if (!caption) {
      if (seenUncaptioned) {
        break;
      }
      seenUncaptioned = true;
    }
    main.push(table);
  }
  return main;
}

/** The heading's wrapper, which is what the section's content now follows. */
function sectionStart(heading: Element): Element {
  const parent = heading.parentElement;
  return parent && /mw-heading/.test(parent.className) ? parent : heading;
}

/**
 * The older form: a heading followed by `<ol>`s, with no tracklist template.
 *
 * Two of the sampled 60 pages are like this. Each list is classified by the text that
 * introduces it, which on these pages is a bold paragraph or a subheading rather than a caption.
 */
/**
 * The text introducing a list, if this element is introducing one.
 *
 * Only a subheading or a wholly bold paragraph counts, which is how these pages label a bonus
 * list. Taking any short line was wrong in a way worth remembering: Jackson Browne's debut is
 * introduced by "All tracks are written by Jackson Browne.", which named no edition and so fell
 * through to the unrecognised case, and the album's entire tracklist was filed as a bonus list.
 * That default is right for a caption and wrong for prose.
 */
function labelOf(element: Element): string | undefined {
  if (/^H[3-6]$/.test(element.tagName)) {
    return contentText(element);
  }
  const wrapper = /mw-heading/.test(element.className) ? element.firstElementChild : undefined;
  if (wrapper && /^H[3-6]$/.test(wrapper.tagName)) {
    return contentText(wrapper);
  }
  if (element.tagName === 'P') {
    const bold = element.getElementsByTagName('b');
    const text = contentText(element);
    if (bold.length === 1 && contentText(bold[0]) === text) {
      return text;
    }
  }
  return undefined;
}

function fromLists(doc: Document, albumName: string): TracklistResult {
  const heading = [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6')]
    .find((candidate) => /^track ?list(ing)?s?$/i.test(contentText(candidate)));
  if (!heading) {
    return {alternate: [], main: [], readable: false};
  }
  const main = [] as TrackInfo[];
  const alternate = [] as TrackInfo[];
  let label = '';
  let node = sectionStart(heading).nextElementSibling;
  while (node) {
    if (node.tagName === 'H2' || (node.querySelector && node.querySelector('h2'))) {
      break;
    }
    if (node.tagName === 'OL') {
      const tracks = tracksFromList(node);
      if (saysAlternate(label)) {
        alternate.push(...tracks);
      } else {
        main.push(...tracks);
      }
    } else {
      const found = labelOf(node);
      if (found !== undefined) {
        label = found;
      }
    }
    node = node.nextElementSibling;
  }
  return {alternate, main, readable: main.length > 0};
}

export function getTracklists(doc: Document, albumName: string): TracklistResult {
  const tables = [...doc.querySelectorAll('table.tracklist')] as HTMLTableElement[];
  if (!tables.length) {
    return fromLists(doc, albumName);
  }
  const main = mainTables(tables, albumName);
  const mainTracks = main.map(tracksFromTable).flat();
  const alternate = tables.filter((table) => main.indexOf(table) < 0)
    .map(tracksFromTable).flat();
  return {alternate, main: mainTracks, readable: mainTracks.length > 0};
}
