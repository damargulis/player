import {
  availableModels,
  isUsingDefaultModel,
  MODELS_TTL_MS,
  modelsAreStale,
  selectedModel,
  selectModel,
  toModelInfo,
} from './models';
import {DATA_DIR} from '../constants';
import {DJ_MODEL} from './model';
import fs from 'fs';

beforeEach(() => {
  try {
    fs.unlinkSync(`${DATA_DIR}/dj-models.json`);
  } catch (err) {
    // no store yet
  }
});

describe('toModelInfo', () => {
  it('maps a /v1/models entry', () => {
    expect(toModelInfo({
      created_at: '2026-09-21T18:00:00Z', display_name: 'Claude Opus 5.5',
      id: 'claude-opus-5-5', lifecycle: 'active',
    })).toStrictEqual({
      createdAt: '2026-09-21T18:00:00Z', displayName: 'Claude Opus 5.5',
      id: 'claude-opus-5-5', lifecycle: 'active',
    });
  });

  it('falls back to the id when there is no display name', () => {
    expect(toModelInfo({id: 'claude-x-9'}).displayName).toEqual('claude-x-9');
  });

  it('assumes active when lifecycle is absent, rather than hiding the model', () => {
    expect(toModelInfo({id: 'claude-x-9'}).lifecycle).toEqual('active');
  });
});

describe('model selection', () => {
  it('uses the built-in default when nothing is chosen', () => {
    expect(selectedModel()).toEqual(DJ_MODEL);
    expect(isUsingDefaultModel()).toBe(true);
  });

  it('uses an override once one is set', () => {
    selectModel('claude-sonnet-5-5');
    expect(selectedModel()).toEqual('claude-sonnet-5-5');
    expect(isUsingDefaultModel()).toBe(false);
  });

  // Clearing must return to the default rather than persisting an empty string, which would
  // send model:"" to the API.
  it('clears back to the default', () => {
    selectModel('claude-sonnet-5-5');
    selectModel(undefined);
    expect(selectedModel()).toEqual(DJ_MODEL);
    expect(isUsingDefaultModel()).toBe(true);
  });

  it('treats choosing the default explicitly as no override', () => {
    selectModel(DJ_MODEL);
    expect(isUsingDefaultModel()).toBe(true);
  });
});

describe('availableModels', () => {
  // The dropdown must never be empty, or there would be no way back to a working model.
  it('always offers the default, even with nothing cached', () => {
    expect(availableModels().map((m) => m.id)).toContain(DJ_MODEL);
  });
});

describe('modelsAreStale', () => {
  it('is stale when never fetched', () => {
    expect(modelsAreStale()).toBe(true);
  });

  // A refresh must not forget the chosen model: the list and the choice share one file.
  it('keeps the selection across a list refresh', () => {
    selectModel('claude-sonnet-5-5');
    fs.writeFileSync(`${DATA_DIR}/dj-models.json`, JSON.stringify(Object.assign(
      JSON.parse(fs.readFileSync(`${DATA_DIR}/dj-models.json`, 'utf8')),
      {fetchedAt: Date.now(), models: [{createdAt: '', displayName: 'X', id: 'x', lifecycle: 'active'}]},
    )));
    expect(selectedModel()).toEqual('claude-sonnet-5-5');
    expect(modelsAreStale()).toBe(false);
    expect(modelsAreStale(Date.now() + MODELS_TTL_MS + 1)).toBe(true);
  });
});
