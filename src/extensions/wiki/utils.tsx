import {formatGenre} from '../../utils';

function getLeafNodes(rootNode: ChildNode): ChildNode[] {
  if (rootNode.childNodes.length > 0) {
    const children = [];
    for (const node of rootNode.childNodes) {
      children.push(...getLeafNodes(node));
    }
    return children;
  }
  return [rootNode];
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
    (genre) => genre.length > 1);
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

interface Errorable {
  errors: string[];
}

export function removeError(item: Errorable, err: string): void {
  const index = item.errors.indexOf(err);
  if (index >= 0) {
    item.errors = [
      ...item.errors.slice(0, index),
      ...item.errors.slice(index + 1),
    ];
  }
}

export function addError(item: Errorable, err: string): void {
  if (!item.errors.includes(err)) {
    item.errors.push(err);
  }
}
