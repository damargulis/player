import {API_VERSION, apiHeaders, apiKeyHelp, getApiKey} from './apiAuth';
import {DJ_MODEL, modelLabel} from './model';
import {selectedModel} from './models';

export {apiHeaders, apiKeyHelp, DJ_MODEL, getApiKey, modelLabel};

// Hand-rolled Messages API client: the official SDK's typings/JS output need a
// newer TypeScript/webpack than this project can run, so we talk to the
// endpoint directly with the renderer's fetch.

const API_URL = 'https://api.anthropic.com/v1/messages';

const API_KEY_NAME = 'ANTHROPIC_API_KEY';

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
  signature: string;
}

export interface RedactedThinkingBlock {
  type: 'redacted_thinking';
  data: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ServerToolUseBlock {
  type: 'server_tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ServerToolResultBlock {
  type: 'web_search_tool_result' | 'web_fetch_tool_result';
  tool_use_id: string;
  content: unknown;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
  cache_control?: CacheControl;
}

export interface CacheControl {
  type: 'ephemeral';
}

export type ContentBlock = TextBlock | ThinkingBlock | RedactedThinkingBlock | ToolUseBlock | ToolResultBlock
  | ServerToolUseBlock | ServerToolResultBlock;

export interface MessageParam {
  role: 'user' | 'assistant';
  content: ContentBlock[];
}

export interface JSONSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description: string;
    items?: {type: string};
    enum?: string[];
  }>;
  required?: string[];
}

export interface Tool {
  name: string;
  description: string;
  input_schema: JSONSchema;
}

/** An Anthropic-defined tool such as the memory tool or web search: no schema, just type + name. */
export interface AnthropicTool {
  type: string;
  name: string;
  max_uses?: number;
}

export type ToolDefinition = Tool | AnthropicTool;

export type StopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | 'pause_turn' | 'refusal';

export interface MessageResponse {
  id: string;
  content: ContentBlock[];
  stop_reason: StopReason;
  stop_details?: {
    type: string;
    category?: string;
    explanation?: string;
  };
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

interface ErrorResponse {
  error?: {
    type: string;
    message: string;
  };
}

/** Live progress callbacks; deltas arrive as the model produces them. */
export interface StreamHandlers {
  onThinking?(delta: string): void;
  onText?(delta: string): void;
}

/** Shape we mutate while assembling streamed blocks, before handing back ContentBlocks. */
interface PartialBlock {
  type: string;
  text?: string;
  thinking?: string;
  signature?: string;
  data?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: unknown;
}

interface StreamEvent {
  type: string;
  index?: number;
  message?: {id: string; usage: MessageResponse['usage']};
  content_block?: PartialBlock;
  delta?: {
    type?: string;
    text?: string;
    thinking?: string;
    signature?: string;
    partial_json?: string;
    stop_reason?: StopReason;
    stop_details?: MessageResponse['stop_details'];
  };
  usage?: MessageResponse['usage'];
  error?: {type: string; message: string};
}

export interface CreateMessageParams {
  system: string;
  tools: ToolDefinition[];
  messages: MessageParam[];
  maxTokens?: number;
  effort?: 'low' | 'medium' | 'high';
}

export class DJApiError extends Error {
  public status: number;
  public errorType: string;
  constructor(status: number, message: string, errorType: string = '') {
    super(message);
    this.status = status;
    this.errorType = errorType;
  }

  /**
   * True for failures the listener has to act on (bad key, spent credits, rate limits,
   * Anthropic outages) as opposed to bugs in our own request.
   */
  public needsAttention(): boolean {
    if (this.status === 401 || this.status === 403 || this.status === 402 || this.status === 429) {
      return true;
    }
    if (this.status >= 500) {
      return true;
    }
    return /credit balance|billing|quota|too low/i.test(this.message);
  }

  /** A short, plain-language headline for an alert box. */
  public headline(): string {
    if (this.status === 429) {
      return 'The DJ is being rate limited by the Anthropic API.';
    }
    if (this.status === 401 || this.status === 403) {
      return 'The Anthropic API rejected the API key.';
    }
    if (this.status === 402 || /credit balance|billing|quota|too low/i.test(this.message)) {
      return 'The Anthropic API account is out of credits.';
    }
    if (this.status >= 500) {
      return 'The Anthropic API is unavailable right now.';
    }
    return 'The DJ hit an API error.';
  }
}

/**
 * One round-trip to the Messages API, streamed. The system prompt and the final message get
 * cache breakpoints so a long DJ conversation mostly reads from cache; `handlers` receive
 * thinking and text deltas as they arrive, and the assembled result is the same shape a
 * non-streamed call would return, so the tool loop doesn't care which was used.
 */
export async function createMessage(
  params: CreateMessageParams,
  handlers: StreamHandlers = {},
): Promise<MessageResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new DJApiError(401, `No ${API_KEY_NAME} found. ${apiKeyHelp()}`, 'missing_api_key');
  }
  const messages = params.messages.map((msg, i) => {
    if (i !== params.messages.length - 1 || !msg.content.length) {
      return msg;
    }
    const content = msg.content.slice();
    const last = content[content.length - 1];
    content[content.length - 1] = Object.assign({}, last, {cache_control: {type: 'ephemeral'}});
    return Object.assign({}, msg, {content});
  });
  const body = {
    max_tokens: params.maxTokens || 16000,
    stream: true,
    messages,
    // selectedModel() is the override-aware read; DJ_MODEL is only the fallback inside it
    model: selectedModel(),
    output_config: {effort: params.effort || 'medium'},
    system: [{type: 'text', text: params.system, cache_control: {type: 'ephemeral'}}],
    thinking: {display: 'summarized', type: 'adaptive'},
    tools: params.tools,
  };
  const res = await fetch(API_URL, {
    body: JSON.stringify(body),
    headers: {
      'anthropic-version': API_VERSION,
      'content-type': 'application/json',
      'x-api-key': apiKey,
    },
    method: 'POST',
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    let errorType = '';
    try {
      const parsed = JSON.parse(text) as ErrorResponse;
      if (parsed.error) {
        message = parsed.error.message;
        errorType = parsed.error.type;
      }
    } catch (err) {
      // keep raw text
    }
    throw new DJApiError(res.status, message, errorType);
  }
  if (!res.body) {
    throw new DJApiError(502, 'The API returned no response body to stream.', 'empty_body');
  }
  return readStream(res.body, handlers);
}

/** Assembles a streamed response, forwarding deltas to `handlers` as they arrive. */
async function readStream(body: ReadableStream<Uint8Array>, handlers: StreamHandlers): Promise<MessageResponse> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const blocks: PartialBlock[] = [];
  const partialJson: Record<number, string> = {};
  let buffer = '';
  let id = '';
  let stopReason: StopReason = 'end_turn';
  let stopDetails: MessageResponse['stop_details'];
  let usage: MessageResponse['usage'] = {input_tokens: 0, output_tokens: 0};

  const handleEvent = (event: StreamEvent): void => {
    const index = event.index === undefined ? 0 : event.index;
    switch (event.type) {
    case 'message_start':
      if (event.message) {
        id = event.message.id;
        usage = event.message.usage || usage;
      }
      return;
    case 'content_block_start':
      // Blocks that never delta (e.g. web_search_tool_result) arrive complete right here.
      blocks[index] = Object.assign({type: 'text'}, event.content_block);
      return;
    case 'content_block_delta': {
      const block = blocks[index] || {type: 'text'};
      const delta = event.delta || {};
      if (delta.text !== undefined) {
        block.text = `${block.text || ''}${delta.text}`;
        if (handlers.onText) {
          handlers.onText(delta.text);
        }
      }
      if (delta.thinking !== undefined) {
        block.thinking = `${block.thinking || ''}${delta.thinking}`;
        if (handlers.onThinking) {
          handlers.onThinking(delta.thinking);
        }
      }
      if (delta.signature !== undefined) {
        // Thinking blocks must be replayed with their signature intact.
        block.signature = `${block.signature || ''}${delta.signature}`;
      }
      if (delta.partial_json !== undefined) {
        partialJson[index] = `${partialJson[index] || ''}${delta.partial_json}`;
      }
      blocks[index] = block;
      return;
    }
    case 'content_block_stop': {
      const raw = partialJson[index];
      if (raw !== undefined && blocks[index]) {
        try {
          blocks[index].input = JSON.parse(raw || '{}') as Record<string, unknown>;
        } catch (err) {
          blocks[index].input = {};
        }
      }
      return;
    }
    case 'message_delta':
      if (event.delta && event.delta.stop_reason) {
        stopReason = event.delta.stop_reason;
        stopDetails = event.delta.stop_details;
      }
      if (event.usage) {
        usage = Object.assign({}, usage, event.usage);
      }
      return;
    case 'error':
      throw new DJApiError(502, event.error ? event.error.message : 'The stream failed.',
        event.error ? event.error.type : 'stream_error');
    default:
      return;
    }
  };

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }
    buffer += decoder.decode(chunk.value, {stream: true});
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      // Each SSE frame carries the event name in its own json, so the `event:` lines are noise.
      if (line.startsWith('data:')) {
        handleEvent(JSON.parse(line.slice('data:'.length).trim()) as StreamEvent);
      }
      newline = buffer.indexOf('\n');
    }
  }

  return {
    content: blocks.filter(Boolean) as unknown as ContentBlock[],
    id,
    stop_details: stopDetails,
    stop_reason: stopReason,
    usage,
  };
}
