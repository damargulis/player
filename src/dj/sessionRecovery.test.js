import {RETRY_DELAYS_MS} from "./api";
import session, {cutOffResults} from "./session";

/**
 * A request failing partway through a turn used to kill the session: the catch popped only the
 * last message, leaving the DJ's tool_use with no tool_result, and the API rejects every later
 * request over that. These drive the real session against a stubbed fetch.
 */

function sse(events) {
  const text = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
  return new Response(new Blob([text]).stream(), {status: 200});
}

function toolCall(id, name, json, stopReason = "tool_use") {
  return sse([
    {type: "message_start", message: {id: "m", usage: {input_tokens: 1, output_tokens: 1}}},
    {type: "content_block_start", index: 0, content_block: {type: "tool_use", id, name}},
    {type: "content_block_delta", index: 0, delta: {partial_json: json}},
    {type: "content_block_stop", index: 0},
    {type: "message_delta", delta: {stop_reason: stopReason}},
  ]);
}

function reply(text, contextManagement) {
  return sse([
    {type: "message_start", message: {id: "m", usage: {input_tokens: 1, output_tokens: 1}}},
    {type: "content_block_start", index: 0, content_block: {type: "text", text: ""}},
    {type: "content_block_delta", index: 0, delta: {text}},
    {type: "content_block_stop", index: 0},
    {type: "message_delta", delta: {stop_reason: "end_turn"}, context_management: contextManagement},
  ]);
}

function failure(status, type) {
  return new Response(JSON.stringify({error: {type, message: type}}), {status});
}

/** Every tool_use in the history is answered in the very next message — what the API checks. */
function pairedUp(messages) {
  return messages.every((message, i) => {
    const uses = message.role === "assistant" ? message.content.filter((b) => b.type === "tool_use") : [];
    if (!uses.length) {
      return true;
    }
    const next = messages[i + 1];
    const answered = next ? next.content.filter((b) => b.type === "tool_result").map((b) => b.tool_use_id) : [];
    return uses.every((use) => answered.includes(use.id));
  });
}

let responses;
let bodies;
let headers;
const realFetch = window.fetch;

function idle() {
  return new Promise((resolve) => {
    const check = () => (session.getState().busy ? setTimeout(check, 5) : resolve());
    setTimeout(check, 5);
  });
}

beforeAll(() => {
  process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test-key";
  RETRY_DELAYS_MS.splice(0, RETRY_DELAYS_MS.length, 1, 1, 1);
});

beforeEach(() => {
  session.reset();
  bodies = [];
  headers = [];
  window.fetch = global.fetch = (url, init) => {
    bodies.push(JSON.parse(init.body));
    headers.push(init.headers);
    const next = responses.shift();
    return Promise.resolve(typeof next === "function" ? next() : next);
  };
});

afterAll(() => {
  window.fetch = global.fetch = realFetch;
});

describe("the DJ session after a failure", () => {
  it("rolls a turn that failed after a tool round back, so the next message works", async () => {
    responses = [toolCall("t1", "now_playing", "{}"), failure(400, "invalid_request_error"), reply("hi")];
    session.send("first");
    await idle();
    session.send("second");
    await idle();
    const last = bodies[bodies.length - 1];
    expect(pairedUp(last.messages)).toBe(true);
    expect(last.messages.map((m) => m.role)).toEqual(["user"]);
    expect(JSON.stringify(last.messages)).toContain("second");
  });

  it("retries an overload instead of failing the turn", async () => {
    responses = [failure(529, "overloaded_error"), failure(500, "api_error"), reply("made it")];
    session.send("hello");
    await idle();
    expect(bodies.length).toBe(3);
    const entries = session.getState().entries;
    expect(entries.filter((e) => e.role === "error")).toEqual([]);
    expect(entries[entries.length - 1].text).toBe("made it");
  });

  it("answers a cut-off tool call without running it, keeping the history valid", async () => {
    responses = [toolCall("t1", "set_queue", "{\"track_ids\": [\"a\"", "max_tokens"), reply("done")];
    session.send("queue something");
    await idle();
    const second = bodies[1];
    expect(pairedUp(second.messages)).toBe(true);
    const result = second.messages[second.messages.length - 1].content[0];
    expect(result.is_error).toBe(true);
  });
});

describe("cutOffResults", () => {
  it("answers every call", () => {
    expect(cutOffResults([{id: "a"}, {id: "b"}]).map((r) => r.tool_use_id)).toEqual(["a", "b"]);
  });
});

/**
 * Old tool results are cleared by the API now, not by rewriting our own history: the client sends
 * every turn unchanged, so the cached prefix and the turns carrying thinking stay valid.
 */
describe("context editing", () => {
  it("asks the API to clear old tool results, never the memory tool's, on every request", async () => {
    responses = [reply("hi")];
    session.send("hello");
    await idle();
    expect(headers[0]["anthropic-beta"]).toContain("context-management-2025-06-27");
    const [edit] = bodies[0].context_management.edits;
    expect(edit.type).toBe("clear_tool_uses_20250919");
    expect(edit.exclude_tools).toEqual(["memory"]);
    expect(edit.trigger.value).toBeGreaterThan(edit.clear_at_least.value);
  });

  it("sends earlier turns exactly as they were first sent", async () => {
    // four turns: the old trimming only rewrote results more than two user turns back
    responses = [toolCall("t1", "now_playing", "{}"), reply("one"), reply("two"), reply("three"), reply("four")];
    for (const text of ["first", "second", "third", "fourth"]) {
      session.send(text);
      await idle();
    }
    const sent = bodies.map((body) => body.messages);
    // strip the cache marker, which always rides on the newest block only
    const plain = (messages) => JSON.stringify(messages).replace(/,"cache_control":\{"type":"ephemeral"\}/g, "");
    for (let i = 1; i < sent.length; i++) {
      expect(plain(sent[i].slice(0, sent[i - 1].length))).toBe(plain(sent[i - 1]));
    }
  });

  it("notes a clear in the Verbose transcript", async () => {
    responses = [reply("hi", {applied_edits: [{type: "clear_tool_uses_20250919", cleared_tool_uses: 8,
      cleared_input_tokens: 50000}]})];
    session.send("hello");
    await idle();
    const note = session.getState().entries.find((e) => e.role === "tool" && /Cleared 8/.test(e.text));
    expect(note).toBeDefined();
  });
});

