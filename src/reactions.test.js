import {applyReaction, currentReaction, describeReactions, toggleReaction} from "./reactions";

function track(reactions) {
  return {id: "t1", name: "One", reactions};
}

test("a track with no reactions reads as none", () => {
  expect(currentReaction(track(undefined), "Chloe", 2026)).toBe("none");
  expect(describeReactions(track(undefined), 2026)).toBe("");
});

test("liking records the year for that person only", () => {
  const next = applyReaction(track(undefined), "Chloe", "like", 2026);
  expect(next).toStrictEqual({Chloe: {disliked: [], liked: [2026]}});
  expect(currentReaction(track(next), "Chloe", 2026)).toBe("like");
  // a different person, and a different year, are untouched
  expect(currentReaction(track(next), "Daniel", 2026)).toBe("none");
  expect(currentReaction(track(next), "Chloe", 2025)).toBe("none");
});

test("one opinion at a time: disliking clears a like for that year", () => {
  let reactions = applyReaction(track(undefined), "Chloe", "like", 2026);
  reactions = applyReaction(track(reactions), "Chloe", "dislike", 2026);
  expect(reactions).toStrictEqual({Chloe: {disliked: [2026], liked: []}});
  expect(currentReaction(track(reactions), "Chloe", 2026)).toBe("dislike");
});

test("earlier years survive a new verdict", () => {
  let reactions = applyReaction(track(undefined), "Chloe", "like", 2025);
  reactions = applyReaction(track(reactions), "Chloe", "dislike", 2026);
  expect(reactions.Chloe.liked).toStrictEqual([2025]);
  expect(reactions.Chloe.disliked).toStrictEqual([2026]);
});

test("pressing the same button again clears the verdict and the person", () => {
  const liked = applyReaction(track(undefined), "Chloe", "like", 2026);
  expect(toggleReaction(track(liked), "Chloe", "like", 2026)).toBe("none");
  const cleared = applyReaction(track(liked), "Chloe", "none", 2026);
  expect(cleared.Chloe).toBeUndefined();
});

test("several people can disagree about the same track", () => {
  let reactions = applyReaction(track(undefined), "Chloe", "like", 2026);
  reactions = applyReaction(track(reactions), "Sam", "dislike", 2026);
  expect(describeReactions(track(reactions), 2026)).toBe("♥Chloe ✗Sam");
});
