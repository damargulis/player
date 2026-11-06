import {formatGenre} from '../../utils';

/**
 * Elements whose text is not content.
 *
 * Wikipedia injects **TemplateStyles** into the infobox — a `<style>` element sitting right
 * inside the genre cell, carrying the Hlist stylesheet. Walking into it read the CSS as text
 * and split it on commas, so `.mw-parser-output .hlist dl` and friends became genres: 39 of
 * them are in this library, on most pages the extension has touched.
 */
const NON_CONTENT_TAGS = ['STYLE', 'SCRIPT', 'NOSCRIPT', 'TEMPLATE'];

function getLeafNodes(rootNode: ChildNode): ChildNode[] {
  if (NON_CONTENT_TAGS.includes(rootNode.nodeName)) {
    return [];
  }
  if (rootNode.childNodes.length > 0) {
    const children = [];
    for (const node of rootNode.childNodes) {
      children.push(...getLeafNodes(node));
    }
    return children;
  }
  return [rootNode];
}

/**
 * Rejects anything that is plainly not a genre name.
 *
 * A second line of defence rather than the fix: skipping `<style>` is what stops CSS arriving,
 * but a stylesheet reaching this far once already cost 39 junk genres that then had to be
 * cleaned out of the library, and a genre is cheap to sanity-check.
 *
 * Structural only — braces, semicolons, angle brackets and a leading dot are css, not music.
 * There is no length limit: every one of those 39 was caught by these characters alone, so a
 * limit rejected nothing real while standing ready to throw away a long genuine genre.
 */
function looksLikeGenre(genre: string): boolean {
  return !/[{};<>]/.test(genre) && !genre.startsWith('.');
}

export function sanitize(str: string): string {
  // removes text in parenthesis or brackets, turns any whitespace into a single space.
  return str.replace(/\s*[[(].*?[\])]\s*/g, '').replace(/\s+/g, ' ');
}

function getGenres(rootNode: ChildNode): string[] {
  const leafNodes = getLeafNodes(rootNode);
  // filter out ", ", " ", ".", and any other weird symbols that might be
  // accidental
  const textNodes = leafNodes.filter((node) => node.textContent);
  const text = textNodes
    .map((node) => node.textContent && node.textContent.split(','))
    .flat().filter(Boolean) as string[];
  const sanitized = text.map((genre) => sanitize(genre));
  return sanitized.map((genre) => formatGenre(genre)).filter(Boolean).filter(
    (genre) => genre.length > 1).filter(looksLikeGenre);
}

export function getGenresByRow(rows: HTMLCollectionOf<HTMLTableRowElement>): string[] {
  for (const row of rows) {
    const headers = row.getElementsByTagName('th');
    const name = headers[0] && headers[0].textContent;
    if (name === 'Genre' || name === 'Genres') {
      const data = row.getElementsByTagName('td')[0];
      return getGenres(data);
    }
  }
  return [];
}

// TODO: should do this by prio not just fastest? -- otherwise need the
// isRightLInk check to be better
//
export async function findAsync<T>(arr: T[], asyncCallback: (item: T) => Promise<boolean>): Promise<T> {
  const promises = arr.map(asyncCallback);
  const results = await Promise.all(promises);
  const index = results.findIndex((result) => result);
  return arr[index];
}

export function getDoc(htmlString: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(htmlString, 'text/html');
}
