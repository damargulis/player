import MetaRow from "./MetaRow";

/**
 * The run handling is what the four rows gained by sharing this, so it is the part worth
 * pinning — especially the rejection path, which the wiki and MusicBrainz rows never had.
 *
 * Driven directly rather than through a render: there is no component renderer wired up here
 * (this file importing a .tsx at all is new, and only possible since babel.config.js learnt
 * the React preset).
 */
function row(props) {
  const instance = new MetaRow(props);
  instance.setState = (next) => Object.assign(instance.state, next);
  return instance;
}

test("a plain callback leaves nothing pending", () => {
  let ran = 0;
  const instance = row({label: "Wiki Page", onRun: () => { ran++; }});
  instance.run();
  expect(ran).toBe(1);
  expect(instance.state.running).toBe(false);
});

test("a thenable marks it running until it settles", () => {
  let resolve;
  const instance = row({label: "Cover art", onRun: () => new Promise((r) => { resolve = r; })});
  instance.run();
  expect(instance.state.running).toBe(true);
  resolve();
  return Promise.resolve().then(() => Promise.resolve()).then(() => {
    expect(instance.state.running).toBe(false);
    expect(instance.state.message).toBeUndefined();
  });
});

/** The gap this closed: those two rows dropped the promise, so a failed run said nothing. */
test("a rejection is reported beside the row rather than swallowed", () => {
  const instance = row({label: "Wiki Page", onRun: () => Promise.reject(new Error("404"))});
  instance.run();
  return Promise.resolve().then(() => Promise.resolve()).then(() => {
    expect(instance.state.running).toBe(false);
    expect(instance.state.message).toBe("404");
  });
});

/** es6-promise-pool's thenable has only the two-argument then, no .catch. */
test("works with a PromiseLike that has no catch", () => {
  const thenable = {then: (ok, fail) => fail(new Error("pool failed"))};
  const instance = row({label: "MusicBrainz", onRun: () => thenable});
  instance.run();
  expect(instance.state.message).toBe("pool failed");
  expect(instance.state.running).toBe(false);
});

test("no run callback is a no-op", () => {
  const instance = row({label: "Picture"});
  expect(() => instance.run()).not.toThrow();
  expect(instance.state.running).toBe(false);
});
