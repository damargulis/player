/**
 * Capitalizes a word.
 * @param {string} word The word to capitalize.
 * @return {string} The capitalized word.
 */
function capitalize(word) {
  if (word === "and") {
    return word;
  }
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Gets an array of all leaf nodes given a root node.
 * @param {!Node} rootNode The root node to find all leafs for.
 * @return {!Array<!Node>} All the leaf nodes.
 */
function getLeafNodes(rootNode) {
  if (rootNode.childNodes.length > 0) {
    const children = [];
    for (let ind = 0; ind < rootNode.childNodes.length; ind++) {
      children.push(...getLeafNodes(rootNode.childNodes[ind]));
    }
    return children;
  }
  return [rootNode];
}

/**
 * Formats a wikipedia genre string into a comma separated list.
 * @param {string} genre The genre string as parsed from wikipedia.
 * @return {!Array<string>} List of genres found.
 */
function formatGenre(genre) {
  const genreString = genre.trim().split(' ').map(
    (word) => capitalize(word)).join(' ');
  return genreString.split('-').map((word) => capitalize(word)).join('-');
}

/**
 * Removes any text between parenthesis and turn any extra
 * whitespace into a regular space.
 * @param {string} string The string to sanitize.
 * @return {string} The sanitized string.
 */
export function sanitize(string) {
  return string.replace(/\s*[[(].*?[\])]\s*/g, "").replace(/\s+/g, " ");
}

/**
 * Gets the genres from a genre node on a wiki page.
 * @param {!Node} rootNode The root node of the genre data.
 * @return {!Array<string>} A list of the genres for the album.
 */
function getGenres(rootNode) {
  const leafNodes = getLeafNodes(rootNode);
  // filter out ", ", " ", ".", and any other weird symbols that might be
  // accidental
  const textNodes = leafNodes.filter((node) => node.textContent);
  const text = textNodes.map((node) => node.textContent.split(',')).flat();
  const sanitized = text.map((genre) => sanitize(genre));
  return sanitized.map((genre) => formatGenre(genre)).filter(Boolean).filter(
    (genre) => genre.length > 1);
}

/**
 * Gets the genres from the infobox rows.
 * @param {!Array<!HTMLNode>} rows The rows of a wikipedia infobox.
 * @return {!Array<string>} The genres found.
 */
export function getGenresByRow(rows) {
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

/**
 * TODO: should do this by prio not just fastest? -- otherwise need the
 * isRightLInk check to be better
 * Similar to Array.find() but runs async.
 * @param {!Array<!T>} arr The array to run find on.
 * @param {!Function} asyncCallback The async callback to run, should
 *  return a boolean.
 * @return {T} The first one to return true
 */
export async function findAsync(arr, asyncCallback) {
  const promises = arr.map(asyncCallback);
  const results = await Promise.all(promises);
  const index = results.findIndex(result => result);
  return arr[index];
}

// maybe move into extensions/utils.js?
/**
 * Parses an html string into a doc node.
 * @param {string} htmlString The html of the page as a string.
 * @return {!HTMLNode} The document node.
 */
export function getDoc(htmlString) {
  const parser = new DOMParser();
  return parser.parseFromString(htmlString, 'text/html');
}
