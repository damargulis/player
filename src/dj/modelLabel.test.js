import {DJ_MODEL, modelLabel} from './api';

describe('modelLabel', () => {
  // The label is derived from the id rather than written beside it, so that changing the model
  // cannot leave the UI confidently naming the old one.
  it('reads a two-part version as a decimal', () => {
    expect(modelLabel('claude-opus-5-5')).toEqual('Opus 5.5');
    expect(modelLabel('claude-sonnet-5-5')).toEqual('Sonnet 5.5');
    expect(modelLabel('claude-fable-5-1')).toEqual('Fable 5.1');
  });

  it('handles a single-part version', () => {
    expect(modelLabel('claude-opus-5')).toEqual('Opus 5');
    expect(modelLabel('claude-haiku-4')).toEqual('Haiku 4');
  });

  // Showing the raw id is honest; showing a guess would not be.
  it('falls back to the raw id for an unexpected shape', () => {
    expect(modelLabel('some-other-model')).toEqual('some-other-model');
    expect(modelLabel('claude-opus-5-5-20260401')).toEqual('claude-opus-5-5-20260401');
    expect(modelLabel('')).toEqual('');
  });

  it('defaults to whatever the DJ actually sends', () => {
    expect(modelLabel()).toEqual(modelLabel(DJ_MODEL));
  });

  it('labels the configured model without throwing', () => {
    expect(modelLabel(DJ_MODEL).length).toBeGreaterThan(0);
  });
});
