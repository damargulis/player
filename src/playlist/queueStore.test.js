import DJPlaylist from "./DJPlaylist";
import {restorePlaylist, snapshot} from "./queueStore";
import RandomAlbumPlaylist from "./RandomAlbumPlaylist";
import RandomTrackPlaylist from "./RandomTrackPlaylist";
import {keepKnown} from "./savedQueue";

const track = (id) => ({id});
const library = {
  albums: {
    A: {id: "A", trackIds: ["a1", "a2", "a3"]},
    B: {id: "B", trackIds: ["b1", "b2"]},
    E: {id: "E", trackIds: []},
  },
  tracks: Object.fromEntries(["a1", "a2", "a3", "b1", "b2", "x", "y"].map((id) => [id, track(id)])),
};
const without = (ids) => ({...library, tracks: Object.fromEntries(Object.entries(library.tracks)
  .filter(([id]) => !ids.includes(id)))});

/** Round-trips through JSON, as the file does. */
const roundTrip = (playlist, lib = library) =>
  restorePlaylist(JSON.parse(JSON.stringify(snapshot(playlist, 42))), lib);

describe("restoring the queue", () => {
  it("brings an album shuffle back to the same album and track", () => {
    const shuffle = new RandomAlbumPlaylist(Object.values(library.albums));
    shuffle.addAlbum(library.albums.B);
    shuffle.nextAlbum();
    shuffle.addAlbum(library.albums.A);
    shuffle.nextAlbum();
    shuffle.nextTrack();
    const restored = roundTrip(shuffle);
    expect(restored.getCurrentTrack()).toBe("a2");
    expect(restored.getUpcoming()).toEqual(["a3"]);
    expect(restored.hasPrevAlbum()).toBe(true);
    expect(restored.prevAlbum()).toBe("b1");
  });

  it("brings a track shuffle back with its history and its pool", () => {
    const shuffle = new RandomTrackPlaylist([track("x"), track("y")]);
    shuffle.addTrack(track("x"));
    shuffle.nextTrack();
    shuffle.addTrack(track("y"));
    shuffle.nextTrack();
    const restored = roundTrip(shuffle);
    expect(restored.getCurrentTrack()).toBe("y");
    expect(restored.prevTrack()).toBe("x");
    expect(["x", "y"]).toContain(restored.nextTrack() && restored.nextTrack());
  });

  it("brings a DJ queue back with history, current track and what is queued, albums intact", () => {
    const dj = new DJPlaylist();
    dj.adopt("x", []);
    dj.addAlbum(["a1", "a2"], "A", "end");
    dj.nextTrack();
    const restored = roundTrip(dj);
    expect(restored).toBeInstanceOf(DJPlaylist);
    expect(restored.getCurrentTrack()).toBe("a1");
    expect(restored.getUpcomingEntries()).toEqual([{albumId: "A", id: "a2"}]);
    expect(restored.getHistory()).toEqual(["x", "a1"]);
  });

  it("drops deleted tracks, and starts fresh when the one playing is gone", () => {
    const dj = new DJPlaylist();
    dj.adopt("x", ["a1", "y", "a2"]);
    expect(roundTrip(dj, without(["y"])).getUpcoming()).toEqual(["a1", "a2"]);
    expect(roundTrip(dj, without(["x"]))).toBeUndefined();
  });

  it("starts fresh when the album that was playing is gone or empty", () => {
    const shuffle = new RandomAlbumPlaylist(Object.values(library.albums));
    shuffle.addAlbum(library.albums.A);
    shuffle.nextAlbum();
    const lib = {...library, albums: {B: library.albums.B, A: {id: "A", trackIds: []}}};
    expect(roundTrip(shuffle, lib)).toBeUndefined();
  });

  it("saves nothing for a queue that has not started, so it cannot clobber the file", () => {
    expect(snapshot(new RandomAlbumPlaylist([]), 0)).toBeUndefined();
    expect(snapshot(new DJPlaylist(), 0)).toBeUndefined();
  });
});

describe("keepKnown", () => {
  it("moves the index to where its item ended up", () => {
    expect(keepKnown(["a", "gone", "b", "c"], 2, (x) => x, (x) => x !== "gone")).toEqual({index: 1, items: ["a", "b", "c"]});
    expect(keepKnown(["a", "gone"], 1, (x) => x, (x) => x !== "gone").index).toBe(-1);
  });
});
