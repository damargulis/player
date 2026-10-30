import {apiHeaders, getApiKey} from './apiAuth';
import {DATA_DIR} from '../constants';
import fs from 'fs';
import {DJ_MODEL} from './model';

/**
 * Which models the DJ can use, and which one it does.
 *
 * The list comes from the Models API rather than a hard-coded array, so a model released after
 * this code was written shows up on its own — that is the whole point. `DJ_MODEL` stays the
 * built-in default and never moves: a new model changing behaviour and cost without anyone
 * choosing it is not an upgrade, it is a surprise. Picking one here is an override, and
 * clearing it goes back to the default.
 */

const STORE_FILE = () => `${DATA_DIR}/dj-models.json`;

/** A day. The list changes a few times a year; this is about not refetching per render. */
export const MODELS_TTL_MS = 24 * 60 * 60 * 1000;

export interface ModelInfo {
  id: string;
  displayName: string;
  createdAt: string;
  /** 'active' or 'deprecated' — a deprecated model still runs, but is on its way out. */
  lifecycle: string;
}

interface ModelStore {
  fetchedAt?: number;
  models?: ModelInfo[];
  /** The chosen model id. Absent means "use the built-in default". */
  selected?: string;
}

function read(): ModelStore {
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE(), 'utf8')) as ModelStore;
  } catch (err) {
    return {};
  }
}

/**
 * Merges rather than overwrites: the fetched list and the user's choice share this file, and a
 * refresh must not forget which model they picked.
 */
function write(patch: ModelStore): void {
  try {
    fs.writeFileSync(STORE_FILE(), JSON.stringify(Object.assign(read(), patch)), 'utf8');
  } catch (err) {
    // the list falls back to the default and the choice resets; neither is worth throwing over
  }
}

/** The models to offer. Always includes the default, even before the first fetch succeeds. */
export function availableModels(): ModelInfo[] {
  const stored = read().models || [];
  if (stored.some((model) => model.id === DJ_MODEL)) {
    return stored;
  }
  return [{createdAt: '', displayName: DJ_MODEL, id: DJ_MODEL, lifecycle: 'active'}]
    .concat(stored);
}

/** The model the DJ will actually use: the override if one is set, else the built-in default. */
export function selectedModel(): string {
  return read().selected || DJ_MODEL;
}

export function isUsingDefaultModel(): boolean {
  return !read().selected;
}

/** Pass undefined to clear the override and go back to the built-in default. */
export function selectModel(id: string | undefined): void {
  write({selected: id && id !== DJ_MODEL ? id : undefined});
}

export function modelsAreStale(now: number = Date.now()): boolean {
  const {fetchedAt} = read();
  return !fetchedAt || now - fetchedAt >= MODELS_TTL_MS;
}

/** Shapes one `/v1/models` entry. Unknown fields are ignored rather than carried around. */
export function toModelInfo(raw: Record<string, unknown>): ModelInfo {
  return {
    createdAt: typeof raw.created_at === 'string' ? raw.created_at : '',
    displayName: typeof raw.display_name === 'string' ? raw.display_name : String(raw.id),
    id: String(raw.id),
    lifecycle: typeof raw.lifecycle === 'string' ? raw.lifecycle : 'active',
  };
}

/**
 * Refreshes the list from the API. Never throws — the caller is a timer or a render.
 *
 * A failure leaves the last good list in place, so losing the network means the dropdown keeps
 * working with what it had rather than collapsing to a single entry.
 */
export async function refreshModels(options: {force?: boolean} = {}): Promise<ModelInfo[]> {
  if (!getApiKey() || (!options.force && !modelsAreStale())) {
    return availableModels();
  }
  try {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
      headers: apiHeaders(),
    });
    if (!res.ok) {
      return availableModels();
    }
    const body = await res.json() as {data?: Array<Record<string, unknown>>};
    const models = (body.data || []).map(toModelInfo).filter((model) => model.id);
    if (!models.length) {
      return availableModels();
    }
    write({fetchedAt: Date.now(), models});
    return models;
  } catch (err) {
    return availableModels();
  }
}
