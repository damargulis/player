import {readEnvValue} from '../envFile';

/**
 * Credentials and transport headers for the Anthropic API.
 *
 * Extracted from `api.tsx` so the model list can authenticate without importing it. `api.tsx`
 * needs to know which model was chosen and `models.tsx` needs to call the API — importing each
 * other directly is a cycle, and this project has already been bitten by one (see `owner.tsx`,
 * extracted for the same reason).
 */

const API_KEY_NAME = 'ANTHROPIC_API_KEY';

export const API_VERSION = '2023-06-01';

export function getApiKey(): string | undefined {
  return readEnvValue(API_KEY_NAME);
}

export function apiKeyHelp(): string {
  return `Add ${API_KEY_NAME}=sk-ant-... to .env.local (dev) or data/.env (packaged) and restart the app.`;
}

/** Auth and version for any endpoint, so the model list cannot drift from messages. */
export function apiHeaders(): Record<string, string> {
  return {
    'anthropic-version': API_VERSION,
    'content-type': 'application/json',
    'x-api-key': getApiKey() || '',
  };
}
