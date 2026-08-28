import {readEnvValue} from '../envFile';

// Hand-rolled Messages API client: the official SDK's typings/JS output need a
// newer TypeScript/webpack than this project can run, so we talk to the
// endpoint directly with the renderer's fetch.

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const API_KEY_NAME = 'ANTHROPIC_API_KEY';

export const DJ_MODEL = 'claude-opus-5';

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

export type ContentBlock = TextBlock | ThinkingBlock | RedactedThinkingBlock | ToolUseBlock | ToolResultBlock;

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

/** An Anthropic-defined tool such as the memory tool: no schema, just type + name. */
export interface AnthropicTool {
  type: string;
  name: string;
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

export interface CreateMessageParams {
  system: string;
  tools: ToolDefinition[];
  messages: MessageParam[];
  maxTokens?: number;
  effort?: 'low' | 'medium' | 'high';
}

export function getApiKey(): string | undefined {
  return readEnvValue(API_KEY_NAME);
}

export function apiKeyHelp(): string {
  return `Add ${API_KEY_NAME}=sk-ant-... to .env.local (dev) or data/.env (packaged) and restart the app.`;
}

export class DJApiError extends Error {
  public status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * One round-trip to the Messages API. The system prompt and the final message
 * get cache breakpoints so a long DJ conversation mostly reads from cache.
 */
export async function createMessage(params: CreateMessageParams): Promise<MessageResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new DJApiError(401, `No ${API_KEY_NAME} found. ${apiKeyHelp()}`);
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
    messages,
    model: DJ_MODEL,
    output_config: {effort: params.effort || 'medium'},
    system: [{type: 'text', text: params.system, cache_control: {type: 'ephemeral'}}],
    thinking: {type: 'adaptive'},
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
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try {
      const parsed = JSON.parse(text) as ErrorResponse;
      message = parsed.error ? `${parsed.error.type}: ${parsed.error.message}` : text;
    } catch (err) {
      // keep raw text
    }
    throw new DJApiError(res.status, message);
  }
  return JSON.parse(text) as MessageResponse;
}
