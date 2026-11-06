const {getDoc, getGenresByRow} = require('./utils');
const radiohead = require('./test_pages/radiohead');

/**
 * Wikipedia injects **TemplateStyles** into the infobox: a `<style>` element sitting inside the
 * genre cell, carrying the Hlist stylesheet. The leaf-node walk read that CSS as text and split
 * it on commas, so `.mw-parser-output .hlist dl` and 38 more like it became genres in the
 * library — on most pages the extension touched.
 *
 * The fixture is the real infobox as served, so this fails if the skip is ever removed.
 */
function genresOf(html) {
  const doc = getDoc(html);
  const infobox = doc.getElementsByClassName('infobox')[0];
  return getGenresByRow(infobox.getElementsByTagName('tr'));
}

test('reads the real genres out of a live infobox', () => {
  expect(genresOf(radiohead.doc)).toStrictEqual(radiohead.genres);
});

test('does not read TemplateStyles CSS as genres', () => {
  const genres = genresOf(radiohead.doc);
  // the shapes that actually landed in the library
  expect(genres.filter((genre) => genre.includes('mw-'))).toStrictEqual([]);
  expect(genres.filter((genre) => /[{};]/.test(genre))).toStrictEqual([]);
  expect(genres.filter((genre) => genre.startsWith('.'))).toStrictEqual([]);
});

test('rejects css even if it somehow reaches the formatter', () => {
  // belt and braces: a style block nested somewhere the skip does not cover
  const html = '<html><body><table class="infobox"><tr><th>Genres</th><td>' +
    '<span>.mw-parser-output .hlist dl{margin:0;padding:0}</span>' +
    '<a href="#">Shoegaze</a></td></tr></table></body></html>';
  expect(genresOf(html)).toStrictEqual(['Shoegaze']);
});

test('still finds nothing when there is no genre row', () => {
  const html = '<html><body><table class="infobox"><tr><th>Origin</th><td>Oxford</td></tr>' +
    '</table></body></html>';
  expect(genresOf(html)).toStrictEqual([]);
});
