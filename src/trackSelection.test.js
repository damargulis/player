import {describeTracks, resolveSelection} from "./trackSelection";

const track = (id, name = id) => ({id, name});

/**
 * Deleting a multi-row selection looked each row up by index *while* deleting, and every delete
 * re-renders an album or playlist page with a rebuilt, re-sorted list. This replays that: the
 * list shrinks under the loop exactly as the page's does.
 */
function deleteSelected(list, selected) {
  const deleted = [];
  resolveSelection(list.rows, selected).forEach((t) => {
    deleted.push(t.id);
    list.rows = list.rows.filter((row) => row.id !== t.id);
  });
  return deleted;
}

describe("resolveSelection", () => {
  it("deletes the rows that were selected, not the ones that slid into their places", () => {
    const list = {rows: ["a", "b", "c", "d", "e"].map((id) => track(id))};
    expect(deleteSelected(list, [1, 2])).toEqual(["b", "c"]);
    expect(list.rows.map((row) => row.id)).toEqual(["a", "d", "e"]);
  });

  it("handles the last rows of the list, which used to run off the end", () => {
    const list = {rows: ["a", "b", "c"].map((id) => track(id))};
    expect(deleteSelected(list, [1, 2])).toEqual(["b", "c"]);
  });

  it("drops stale indexes and duplicates rather than acting on undefined", () => {
    const rows = ["a", "b"].map((id) => track(id));
    expect(resolveSelection(rows, [1, 1, 7]).map((row) => row.id)).toEqual(["b"]);
  });
});

describe("describeTracks", () => {
  it("names a few tracks and counts the rest", () => {
    const tracks = ["One", "Two", "Three"].map((name, i) => track(String(i), name));
    expect(describeTracks(tracks, 2)).toBe("“One”, “Two” and 1 more");
    expect(describeTracks(tracks.slice(0, 1))).toBe("“One”");
  });
});
