import {DATA_DIR} from './constants';
import fs from 'fs';

function readValueFrom(filePath: string, key: string): string | undefined {
  try {
    const line = fs.readFileSync(filePath, 'utf8').split('\n')
      .find((envLine) => envLine.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim() : undefined;
  } catch (err) {
    return undefined;
  }
}

const cache: Record<string, string> = {};

/**
 * Reads a secret from .env.local (dev), .env, or DATA_DIR/.env (packaged),
 * falling back to the process environment. Cached after the first read.
 */
export function readEnvValue(key: string): string | undefined {
  if (cache[key] === undefined) {
    cache[key] = readValueFrom('.env.local', key) || readValueFrom('.env', key) ||
      readValueFrom(`${DATA_DIR}/.env`, key) || process.env[key] || '';
  }
  return cache[key] || undefined;
}
