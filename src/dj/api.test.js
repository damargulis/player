import {createMessage, DJApiError} from './api';

const originalFetch = global.fetch;

/** Builds a Response whose body streams `frames` as SSE, split across chunk boundaries. */
function sseResponse(frames, chunkSize = 17) {
  const text = frames.map((f) => `event: ${f.type}\ndata: ${JSON.stringify(f)}\n\n`).join('');
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: () => {
          if (offset >= bytes.length) {
            return Promise.resolve({done: true, value: undefined});
          }
          const value = bytes.slice(offset, offset + chunkSize);
          offset += chunkSize;
          return Promise.resolve({done: false, value});
        },
      }),
    },
  };
}

function stubFetch(response) {
  global.fetch = () => Promise.resolve(response);
}

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
});

afterEach(() => {
  global.fetch = originalFetch;
});

test('assembles streamed text and thinking, forwarding deltas live', async () => {
  stubFetch(sseResponse([
    {type: 'message_start', message: {id: 'msg_1', usage: {input_tokens: 10, output_tokens: 0}}},
    {type: 'content_block_start', index: 0, content_block: {type: 'thinking', thinking: '', signature: ''}},
    {type: 'content_block_delta', index: 0, delta: {type: 'thinking_delta', thinking: 'Checking the '}},
    {type: 'content_block_delta', index: 0, delta: {type: 'thinking_delta', thinking: 'crates.'}},
    {type: 'content_block_delta', index: 0, delta: {type: 'signature_delta', signature: 'sig123'}},
    {type: 'content_block_stop', index: 0},
    {type: 'content_block_start', index: 1, content_block: {type: 'text', text: ''}},
    {type: 'content_block_delta', index: 1, delta: {type: 'text_delta', text: 'Queued '}},
    {type: 'content_block_delta', index: 1, delta: {type: 'text_delta', text: 'some folk.'}},
    {type: 'content_block_stop', index: 1},
    {type: 'message_delta', delta: {stop_reason: 'end_turn'}, usage: {input_tokens: 10, output_tokens: 42}},
    {type: 'message_stop'},
  ]));
  const text = [];
  const thinking = [];

  const response = await createMessage(
    {system: 's', tools: [], messages: [{role: 'user', content: [{type: 'text', text: 'hi'}]}]},
    {onText: (d) => text.push(d), onThinking: (d) => thinking.push(d)},
  );

  expect(text).toStrictEqual(['Queued ', 'some folk.']);
  expect(thinking).toStrictEqual(['Checking the ', 'crates.']);
  expect(response.stop_reason).toBe('end_turn');
  expect(response.usage.output_tokens).toBe(42);
  // thinking keeps its signature so the block can be replayed on the next turn
  expect(response.content[0]).toStrictEqual({type: 'thinking', thinking: 'Checking the crates.', signature: 'sig123'});
  expect(response.content[1]).toStrictEqual({type: 'text', text: 'Queued some folk.'});
});

test('reassembles tool_use input from partial json', async () => {
  stubFetch(sseResponse([
    {type: 'message_start', message: {id: 'msg_2', usage: {input_tokens: 5, output_tokens: 0}}},
    {type: 'content_block_start', index: 0,
      content_block: {type: 'tool_use', id: 'toolu_1', name: 'search_albums', input: {}}},
    {type: 'content_block_delta', index: 0, delta: {type: 'input_json_delta', partial_json: '{"genre":'}},
    {type: 'content_block_delta', index: 0, delta: {type: 'input_json_delta', partial_json: '"indie folk"}'}},
    {type: 'content_block_stop', index: 0},
    {type: 'message_delta', delta: {stop_reason: 'tool_use'}},
    {type: 'message_stop'},
  ]));

  const response = await createMessage({system: 's', tools: [], messages: []});

  expect(response.stop_reason).toBe('tool_use');
  expect(response.content[0]).toStrictEqual({
    type: 'tool_use', id: 'toolu_1', name: 'search_albums', input: {genre: 'indie folk'},
  });
});

test('keeps blocks that arrive complete, like server tool results', async () => {
  stubFetch(sseResponse([
    {type: 'message_start', message: {id: 'msg_3', usage: {input_tokens: 1, output_tokens: 0}}},
    {type: 'content_block_start', index: 0,
      content_block: {type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [{title: 'x'}]}},
    {type: 'content_block_stop', index: 0},
    {type: 'message_delta', delta: {stop_reason: 'pause_turn'}},
  ]));

  const response = await createMessage({system: 's', tools: [], messages: []});

  expect(response.stop_reason).toBe('pause_turn');
  expect(response.content[0].type).toBe('web_search_tool_result');
});

test('a mid-stream error surfaces as a DJApiError', async () => {
  stubFetch(sseResponse([
    {type: 'message_start', message: {id: 'msg_4', usage: {input_tokens: 1, output_tokens: 0}}},
    {type: 'error', error: {type: 'overloaded_error', message: 'Overloaded'}},
  ]));

  await expect(createMessage({system: 's', tools: [], messages: []})).rejects.toThrow(DJApiError);
});

test('an http error still reports the api message', async () => {
  stubFetch({
    ok: false,
    status: 429,
    text: () => Promise.resolve(JSON.stringify({error: {type: 'rate_limit_error', message: 'Slow down'}})),
  });

  let caught;
  try {
    await createMessage({system: 's', tools: [], messages: []});
  } catch (err) {
    caught = err;
  }
  expect(caught.status).toBe(429);
  expect(caught.message).toBe('Slow down');
  expect(caught.needsAttention()).toBe(true);
  expect(caught.headline()).toContain('rate limited');
});
