function capitalize(word: string): string {
  if (word === "and") {
    return word;
  }
  return word.charAt(0).toUpperCase() + word.slice(1);
}

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

function formatGenre(genre: string): string {
  const genreString = genre.trim().split(" ").map(
    (word) => capitalize(word)).join(" ");
  return genreString.split("-").map((word) => capitalize(word)).join("-");
}

export function sanitize(str: string): string {
  return str.replace(/\s*[[(].*?[\])]\s*/g, "").replace(/\s+/g, " ");
}

function getGenres(rootNode: ChildNode): string[] {
  const leafNodes = getLeafNodes(rootNode);
  // filter out ", ", " ", ".", and any other weird symbols that might be
  // accidental
  const textNodes = leafNodes.filter((node) => node.textContent);
  const text = textNodes.map((node) => node.textContent && node.textContent.split(",")).flat();
  const sanitized = text.map((genre) => sanitize(genre));
  return sanitized.map((genre) => formatGenre(genre)).filter(Boolean).filter(
    (genre) => genre.length > 1);
}

export function getGenresByRow(rows: HTMLCollectionOf<HTMLTableRowElement>): string[] {
  for (const row of rows) {
    const headers = row.getElementsByTagName("th");
    const name = headers[0] && headers[0].textContent;
    if (name === "Genre" || name === "Genres") {
      const data = row.getElementsByTagName("td")[0];
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
  return parser.parseFromString(htmlString, "text/html");
}
