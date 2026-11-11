import {API_TOOLS} from './session';

/**
 * The two server-side tools are a hand-written list entry each, and a missing one is invisible:
 * the DJ simply says it cannot open a link, which is how web_fetch came to be absent.
 */

function byName(name) {
  return API_TOOLS.find((tool) => tool.name === name);
}

test('the API path offers both search and fetch', () => {
  expect(byName('web_search')).toBeDefined();
  expect(byName('web_fetch')).toBeDefined();
});

test('a fetched page is capped', () => {
  // nothing elides a server tool result, so the page is re-sent on every later round
  expect(byName('web_fetch').max_content_tokens).toBeGreaterThan(0);
  expect(byName('web_fetch').max_uses).toBeGreaterThan(0);
});

test('both are the server-side variants rather than client tools', () => {
  expect(byName('web_fetch').type).toMatch(/^web_fetch_/);
  expect(byName('web_search').type).toMatch(/^web_search_/);
});
