/**
 * The built-in default model, and how to name one.
 *
 * A leaf module with no imports: `api.tsx` and `models.tsx` both need this, and importing it
 * from either would put them in a cycle. Same reason `owner.tsx` exists.
 */

/**
 * The current Opus, and cheaper than Opus 5 ($4/$20 per MTok against $5/$25).
 *
 * Opus 5.5 rejects three things Opus 5 allowed — disabled thinking at any effort, forced
 * `tool_choice`, and a thinking budget — none of which this client sends. Its effort default
 * also dropped from `high` to `medium`, which does not bite here because `createMessage`
 * always sets `output_config.effort` explicitly.
 */
export const DJ_MODEL = 'claude-opus-5-5';

/**
 * A short display name for a model id: `claude-opus-5-5` reads as "Opus 5.5".
 *
 * Derived rather than hard-coded alongside the id, so changing DJ_MODEL cannot leave the UI
 * claiming the old model — which would be worse than showing nothing. Anything that does not
 * match the expected shape falls through to the raw id, which is still the truth.
 */
export function modelLabel(id: string = DJ_MODEL): string {
  const match = /^claude-([a-z]+)-(\d+)(?:-(\d+))?$/.exec(id);
  if (!match) {
    return id;
  }
  const family = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  return `${family} ${match[2]}${match[3] ? `.${match[3]}` : ''}`;
}
